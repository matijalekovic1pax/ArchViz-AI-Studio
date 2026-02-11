/**
 * Material Validation Service
 *
 * Orchestrates the entire material validation pipeline:
 * 1. Process documents one at a time
 * 2. Extract materials from each document
 * 3. Fetch web links for each material
 * 4. Run batch validation via Gemini API
 * 5. Cross-reference with BoQ items
 */

import { nanoid } from 'nanoid';
import { GeminiService, getGeminiService, type BatchTextResult } from './geminiService';
import {
  extractMaterialsFromDocument,
  extractBoqItemsFromDocument,
  fetchAllMaterialLinks,
  buildEnhancedTechnicalPrompt,
  buildEnhancedBoqPrompt,
  pickBoqMatches,
  MaterialCandidate,
  BoQCandidate
} from './materialValidationPipeline';
import type {
  MaterialValidationDocument,
  MaterialValidationChecks,
  MaterialValidationResult,
  ParsedMaterial,
  ValidationIssue,
  BoQItem,
  MaterialCategory,
  EnrichedMaterialCandidate
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ValidationProgress {
  phase: string;
  document?: string;
  materialsProcessed: number;
  materialsTotal: number;
  documentsProcessed: number;
  documentsTotal: number;
}

export type ProgressCallback = (progress: ValidationProgress) => void;

// ============================================================================
// Material Validation Service
// ============================================================================

export class MaterialValidationService {
  private service: GeminiService;
  private onProgress?: ProgressCallback;

  constructor(onProgress?: ProgressCallback) {
    this.service = getGeminiService();
    this.onProgress = onProgress;
  }

  /**
   * Main entry point: validate all documents
   */
  async validateDocuments(
    materialDocs: MaterialValidationDocument[],
    boqDocs: MaterialValidationDocument[],
    checks: MaterialValidationChecks
  ): Promise<MaterialValidationResult> {
    const allMaterials: ParsedMaterial[] = [];
    const allIssues: ValidationIssue[] = [];
    const allBoqItems: BoQItem[] = [];

    // Extract BoQ items once (they're referenced across all materials)
    let boqCandidates: BoQCandidate[] = [];
    if (checks.crossReferenceBoq && boqDocs.length > 0) {
      this.updateProgress({
        phase: 'Parsing BoQ documents',
        documentsProcessed: 0,
        documentsTotal: materialDocs.length,
        materialsProcessed: 0,
        materialsTotal: 0
      });
      const boqResults = await Promise.all(boqDocs.map(extractBoqItemsFromDocument));
      boqCandidates = boqResults.flat();
    }

    // Process each material document one at a time
    for (let docIndex = 0; docIndex < materialDocs.length; docIndex++) {
      const doc = materialDocs[docIndex];

      // Phase 1: Extract materials from this document
      this.updateProgress({
        phase: 'Extracting materials',
        document: doc.name,
        documentsProcessed: docIndex,
        documentsTotal: materialDocs.length,
        materialsProcessed: 0,
        materialsTotal: 0
      });

      const materials = await extractMaterialsFromDocument(doc);
      if (materials.length === 0) continue;

      // Phase 2: Fetch web links for all materials in this document
      this.updateProgress({
        phase: 'Fetching reference links',
        document: doc.name,
        documentsProcessed: docIndex,
        documentsTotal: materialDocs.length,
        materialsProcessed: 0,
        materialsTotal: materials.length
      });

      const enrichedMaterials = await fetchAllMaterialLinks(
        materials,
        (completed, total) => this.updateProgress({
          phase: 'Fetching reference links',
          document: doc.name,
          documentsProcessed: docIndex,
          documentsTotal: materialDocs.length,
          materialsProcessed: completed,
          materialsTotal: total
        })
      );

      // Phase 3: Technical validation using Batch API
      if (checks.technicalSpec) {
        this.updateProgress({
          phase: 'Technical validation (batch)',
          document: doc.name,
          documentsProcessed: docIndex,
          documentsTotal: materialDocs.length,
          materialsProcessed: 0,
          materialsTotal: enrichedMaterials.length
        });

        const { materials: validatedMaterials, issues: techIssues } =
          await this.batchTechnicalValidation(enrichedMaterials, checks);

        allMaterials.push(...validatedMaterials);
        allIssues.push(...techIssues);
      } else {
        // If technical validation is disabled, still add materials as fallbacks
        for (const material of enrichedMaterials) {
          allMaterials.push(this.createFallbackMaterial(material));
        }
      }

      // Phase 4: BoQ cross-reference using Batch API
      if (checks.crossReferenceBoq && boqCandidates.length > 0) {
        this.updateProgress({
          phase: 'BoQ cross-reference (batch)',
          document: doc.name,
          documentsProcessed: docIndex,
          documentsTotal: materialDocs.length,
          materialsProcessed: 0,
          materialsTotal: enrichedMaterials.length
        });

        const { boqItems, issues: boqIssues } =
          await this.batchBoqValidation(enrichedMaterials, boqCandidates, checks);

        allBoqItems.push(...boqItems);
        allIssues.push(...boqIssues);
      }
    }

    return {
      materials: allMaterials,
      issues: allIssues,
      boqItems: allBoqItems,
      summary: this.generateSummary(allMaterials, allIssues)
    };
  }

  /**
   * Run technical validation for a batch of materials
   */
  private async batchTechnicalValidation(
    materials: EnrichedMaterialCandidate[],
    checks: MaterialValidationChecks
  ): Promise<{ materials: ParsedMaterial[]; issues: ValidationIssue[] }> {
    const checkItems = this.buildCheckItems(checks);

    // Build batch requests - one per material
    const requests = materials.map(material => ({
      prompt: buildEnhancedTechnicalPrompt(material, checkItems),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    }));

    // Sequential API calls — one per material for reliability
    const results = await this.sequentialFallback(requests, (completed, total) => {
      this.updateProgress({
        phase: 'Technical validation',
        document: materials[0]?.docName,
        documentsProcessed: 0,
        documentsTotal: 1,
        materialsProcessed: completed,
        materialsTotal: total
      });
    });

    // Parse results
    const parsedMaterials: ParsedMaterial[] = [];
    const issues: ValidationIssue[] = [];

    results.forEach((result, index) => {
      const material = materials[index];
      if (result.error || !result.text) {
        // Create fallback material
        parsedMaterials.push(this.createFallbackMaterial(material));
        issues.push({
          id: nanoid(),
          code: material.code,
          type: 'technical',
          severity: 'error',
          message: 'Validation failed',
          details: result.error || 'No response from AI',
          sourceDocument: material.docName,
          resolved: false
        });
      } else {
        try {
          const parsed = JSON.parse(result.text);
          const parsedMaterial = parsed.material || this.createFallbackMaterial(material);

          // Ensure required fields exist
          parsedMaterial.code = parsedMaterial.code || material.code;
          parsedMaterial.name = parsedMaterial.name || material.name;
          parsedMaterial.source = parsedMaterial.source || material.source;
          parsedMaterial.category = parsedMaterial.category || this.inferCategory(material.code);
          parsedMaterial.notes = parsedMaterial.notes || [];
          parsedMaterial.referenceProduct = parsedMaterial.referenceProduct || { type: '', brand: '' };

          parsedMaterials.push(parsedMaterial);

          if (parsed.issues && Array.isArray(parsed.issues)) {
            // Add IDs to issues if missing
            parsed.issues.forEach((issue: ValidationIssue) => {
              issues.push({
                ...issue,
                id: issue.id || nanoid(),
                code: issue.code || material.code,
                type: issue.type || 'technical',
                sourceDocument: issue.sourceDocument || material.docName,
                resolved: issue.resolved ?? false
              });
            });
          }
        } catch (parseError) {
          parsedMaterials.push(this.createFallbackMaterial(material));
        }
      }
    });

    return { materials: parsedMaterials, issues };
  }

  /**
   * Run BoQ cross-reference validation for a batch of materials
   */
  private async batchBoqValidation(
    materials: EnrichedMaterialCandidate[],
    boqCandidates: BoQCandidate[],
    checks: MaterialValidationChecks
  ): Promise<{ boqItems: BoQItem[]; issues: ValidationIssue[] }> {
    const checkItems = this.buildCheckItems(checks);

    // Build batch requests
    const requests = materials.map(material => {
      const matches = pickBoqMatches(material, boqCandidates);
      return {
        prompt: buildEnhancedBoqPrompt(material, matches, checkItems),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      };
    });

    // Sequential API calls — one per material for reliability
    const results = await this.sequentialFallback(requests, (completed, total) => {
      this.updateProgress({
        phase: 'BoQ cross-reference',
        document: materials[0]?.docName,
        documentsProcessed: 0,
        documentsTotal: 1,
        materialsProcessed: completed,
        materialsTotal: total
      });
    });

    // Parse results
    const boqItems: BoQItem[] = [];
    const issues: ValidationIssue[] = [];

    results.forEach((result, index) => {
      const material = materials[index];
      if (result.text) {
        try {
          const parsed = JSON.parse(result.text);

          if (parsed.boqItems && Array.isArray(parsed.boqItems)) {
            parsed.boqItems.forEach((item: BoQItem) => {
              boqItems.push({
                ...item,
                code: item.code || '',
                section: item.section || '',
                description: item.description || '',
                materialRef: item.materialRef || material.code,
                quantity: item.quantity || { unit: '' }
              });
            });
          }

          if (parsed.issues && Array.isArray(parsed.issues)) {
            parsed.issues.forEach((issue: ValidationIssue) => {
              issues.push({
                ...issue,
                id: issue.id || nanoid(),
                code: issue.code || material.code,
                type: 'boq',
                sourceDocument: issue.sourceDocument || material.docName,
                resolved: issue.resolved ?? false
              });
            });
          }
        } catch (parseError) {
        }
      } else if (result.error) {
        issues.push({
          id: nanoid(),
          code: material.code,
          type: 'boq',
          severity: 'error',
          message: 'BoQ cross-reference failed',
          details: result.error,
          sourceDocument: material.docName,
          resolved: false
        });
      }
    });

    return { boqItems, issues };
  }

  /**
   * Sequential API calls — one per material
   */
  private async sequentialFallback(
    requests: Array<{ prompt: string; generationConfig: any }>,
    onItemComplete?: (completed: number, total: number) => void
  ): Promise<BatchTextResult[]> {
    const results: BatchTextResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      try {
        const text = await this.service.generateText({
          prompt: request.prompt,
          generationConfig: request.generationConfig
        });
        results.push({ text });
      } catch (error) {
        results.push({
          text: null,
          error: error instanceof Error ? error.message : 'Request failed'
        });
      }

      onItemComplete?.(i + 1, requests.length);

      // Delay between requests to avoid rate limiting
      if (i < requests.length - 1) {
        await this.sleep(200);
      }
    }

    return results;
  }

  /**
   * Update progress callback
   */
  private updateProgress(progress: ValidationProgress): void {
    this.onProgress?.(progress);
  }

  /**
   * Build check items array from checks config
   */
  private buildCheckItems(checks: MaterialValidationChecks): string[] {
    const items: string[] = [];
    if (checks.dimensions) items.push('dimensions and measurements');
    if (checks.productRefs) items.push('product references and brands');
    if (checks.quantities) items.push('quantities');
    return items;
  }

  /**
   * Create a fallback material when validation fails
   */
  private createFallbackMaterial(candidate: MaterialCandidate | EnrichedMaterialCandidate): ParsedMaterial {
    return {
      code: candidate.code,
      name: candidate.name,
      category: this.inferCategory(candidate.code),
      description: candidate.specText || '',
      referenceProduct: { type: '', brand: '' },
      drawingRef: '',
      source: candidate.source,
      dimensions: '',
      notes: [],
      application: ''
    };
  }

  /**
   * Infer material category from code prefix
   */
  private inferCategory(code: string): MaterialCategory {
    const prefix = code.substring(0, 2).toUpperCase();
    const validCategories: MaterialCategory[] = ['FF', 'WF', 'IC', 'WP', 'RF', 'L'];
    return validCategories.includes(prefix as MaterialCategory) ? prefix as MaterialCategory : 'FF';
  }

  /**
   * Generate summary text from results
   */
  private generateSummary(materials: ParsedMaterial[], issues: ValidationIssue[]): string {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const passed = materials.length - errors;

    if (errors === 0 && warnings === 0) {
      return `Successfully validated ${materials.length} materials with no issues.`;
    }

    const parts: string[] = [`Validated ${materials.length} materials.`];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (passed > 0) parts.push(`${passed} passed`);

    return parts.join(' | ');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MaterialValidationService instance
 */
export function createMaterialValidationService(onProgress?: ProgressCallback): MaterialValidationService {
  return new MaterialValidationService(onProgress);
}

