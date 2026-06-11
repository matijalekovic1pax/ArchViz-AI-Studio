import fs from 'node:fs';
import parser from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const read = (path) => fs.readFileSync(`${root}/${path}`, 'utf8');
const parseTsx = (source) =>
  parser.parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

const storeSource = read('store.tsx');
const actionsSource = read('lib/appAssistantActions.ts');
const assistantSource = read('components/AppAssistant.tsx');
const apiGatewaySource = read('services/apiGateway.ts');
const topBarSource = read('components/panels/TopBar.tsx');
const visualEditSource = read('components/panels/right/VisualEditPanel.tsx');
const leftRender3dSource = read('components/panels/left/LeftRender3DPanel.tsx');
const leftImageToCadSource = read('components/panels/left/LeftImageToCADPanel.tsx');
const leftMasterplanSource = read('components/panels/left/LeftMasterplanPanel.tsx');
const leftExplodedSource = read('components/panels/left/LeftExplodedPanel.tsx');
const leftSectionSource = read('components/panels/left/LeftSectionPanel.tsx');
const materialValidationViewSource = read('components/MaterialValidationView.tsx');
const materialValidationExportSource = read('lib/materialValidationExport.ts');
const storeAst = parseTsx(storeSource);
const actionsAst = parseTsx(actionsSource);

const variables = new Map();
traverse(storeAst, {
  VariableDeclarator(path) {
    if (path.node.id?.type === 'Identifier') {
      variables.set(path.node.id.name, path.node.init);
    }
  },
});

const resolveNode = (node) =>
  node?.type === 'Identifier' && variables.has(node.name) ? variables.get(node.name) : node;

const flattenObjectLeaves = (node, prefix = '') => {
  const resolved = resolveNode(node);
  if (resolved?.type !== 'ObjectExpression') return [];

  return resolved.properties.flatMap((property) => {
    if (property.type !== 'ObjectProperty') return [];
    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'StringLiteral'
          ? property.key.value
          : null;
    if (!key) return [];
    const leafPath = prefix ? `${prefix}.${key}` : key;
    const value = resolveNode(property.value);
    return value?.type === 'ObjectExpression' ? flattenObjectLeaves(value, leafPath) : [leafPath];
  });
};

const readStringArrayConstant = (ast, name) => {
  let values = [];
  const unwrap = (node) => {
    if (!node) return node;
    if (
      node.type === 'TSAsExpression' ||
      node.type === 'TSSatisfiesExpression' ||
      node.type === 'TSNonNullExpression'
    ) {
      return unwrap(node.expression);
    }
    return node;
  };

  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id?.type !== 'Identifier' || path.node.id.name !== name) return;
      const init = unwrap(path.node.init);
      if (init?.type !== 'ArrayExpression') return;
      values = init.elements.flatMap((element) => element?.type === 'StringLiteral' ? [element.value] : []);
      path.stop();
    },
  });
  return values;
};

const readWorkflowDescriptorPaths = (ast) => {
  const paths = [];
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 'workflow') return;
      const firstArg = path.node.arguments[0];
      if (firstArg?.type === 'StringLiteral') paths.push(firstArg.value);
    },
  });
  return paths;
};

const readStringArrayMapConstant = (ast, name) => {
  const values = {};
  const unwrap = (node) => {
    if (!node) return node;
    if (
      node.type === 'TSAsExpression' ||
      node.type === 'TSSatisfiesExpression' ||
      node.type === 'TSNonNullExpression'
    ) {
      return unwrap(node.expression);
    }
    return node;
  };

  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id?.type !== 'Identifier' || path.node.id.name !== name) return;
      const init = unwrap(path.node.init);
      if (init?.type !== 'ObjectExpression') return;
      for (const property of init.properties) {
        if (property.type !== 'ObjectProperty') continue;
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'StringLiteral'
              ? property.key.value
              : null;
        const value = unwrap(property.value);
        if (!key || value?.type !== 'ArrayExpression') continue;
        values[key] = value.elements.flatMap((element) =>
          element?.type === 'StringLiteral' ? [element.value] : []
        );
      }
      path.stop();
    },
  });
  return values;
};

const requiredImageTargets = [
  'canvas',
  'source',
  'style-reference',
  'background-reference',
  'visual-material-reference',
  'visual-background-reference',
  'scene-compose-reference',
  'sketch-reference',
  'masterplan-input',
  'upscale-batch',
  'video-input',
  'video-start-frame',
  'video-end-frame',
  'video-keyframe',
  'headshot-left',
  'headshot-front',
  'headshot-right',
];

const requiredDownloadActions = [
  'download_project',
  'download_current_image',
  'download_latest_history_image',
  'download_all_history_images',
  'download_current_video',
  'download_translated_document',
  'download_pdf_outputs',
  'download_material_validation_report',
  'download_multi_angle_outputs',
  'download_angle_change_outputs',
  'download_headshots',
];

const requiredFileTargets = [
  'document-translate-source',
  'material-validation-document',
  'pdf-compression-queue',
  'project-import',
];

const requiredCommandActions = [
  'cancel_generation',
  'open_docs',
  'open_feedback_admin',
  'open_feedback_report',
  'redo_selection_change',
  'run_exploded_component_detection',
  'run_image_to_cad_preprocess',
  'run_ai_selection',
  'run_masterplan_zone_detection',
  'run_preprocess',
  'run_section_area_detection',
  'reset_project',
  'set_language',
  'sign_out',
  'undo_selection_change',
];

const requiredCleanupActions = [
  'clear_image_target',
  'clear_file_target',
];

const requiredModes = [
  'generate-text',
  'render-3d',
  'scene-compose',
  'render-cad',
  'masterplan',
  'visual-edit',
  'angle-change',
  'exploded',
  'section',
  'render-sketch',
  'multi-angle',
  'upscale',
  'img-to-cad',
  'video',
  'material-validation',
  'document-translate',
  'pdf-compression',
  'headshot',
];

const workflowLeaves = flattenObjectLeaves(variables.get('initialWorkflow'));
const manualWorkflowPaths = new Set(readWorkflowDescriptorPaths(actionsAst));
const protectedPrefixes = readStringArrayConstant(actionsAst, 'WORKFLOW_DYNAMIC_SKIP_PREFIXES');
const workflowModePathPrefixes = readStringArrayMapConstant(actionsAst, 'WORKFLOW_MODE_PATH_PREFIXES');
const imageTargets = readStringArrayConstant(actionsAst, 'IMAGE_TARGETS');
const fileTargets = readStringArrayConstant(actionsAst, 'FILE_TARGETS');
const downloadActions = readStringArrayConstant(actionsAst, 'DOWNLOAD_ACTION_TYPES');

const isProtected = (path) =>
  protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));

const settableWorkflowLeaves = workflowLeaves.filter((path) => !isProtected(path));
const dynamicWorkflowLeaves = settableWorkflowLeaves.filter((path) => !manualWorkflowPaths.has(path));
const protectedWorkflowLeaves = workflowLeaves.filter(isProtected);
const workflowPathModes = (path) =>
  Object.entries(workflowModePathPrefixes)
    .filter(([, prefixes]) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix)))
    .map(([mode]) => mode);
const missingWorkflowModePrefixes = requiredModes.filter((mode) => !Array.isArray(workflowModePathPrefixes[mode]));
const missingWorkflowModeCoverage = settableWorkflowLeaves.filter((path) => workflowPathModes(path).length === 0);
const missingImageTargets = requiredImageTargets.filter((target) => !imageTargets.includes(target));
const missingDownloadActions = requiredDownloadActions.filter((action) => !downloadActions.includes(action));
const missingDownloadHandlers = requiredDownloadActions.filter((action) => !assistantSource.includes(`case '${action}'`));
const missingCurrentImageDownloadOptions =
  !assistantSource.includes('parseCurrentImageDownloadOptions') ||
  !assistantSource.includes('downloadCurrentImageVariant') ||
  !assistantSource.includes("case 'download_current_image'") ||
  !actionsSource.includes("request.type === 'download_current_image'") ||
  !actionsSource.includes('? request.value') ||
  !actionsSource.includes('For download_current_image, optional value may be');
const missingMaterialValidationReportExport =
  !actionsSource.includes('download_material_validation_report') ||
  !assistantSource.includes("case 'download_material_validation_report'") ||
  !assistantSource.includes('downloadMaterialValidationReport(state.materialValidation)') ||
  !materialValidationViewSource.includes('downloadMaterialValidationReport(state.materialValidation)') ||
  !materialValidationExportSource.includes('buildMaterialValidationReport') ||
  !materialValidationExportSource.includes('downloadMaterialValidationReport');
const missingCustomStyleSupport =
  !actionsSource.includes("| 'add_custom_style'") ||
  !actionsSource.includes("request.type === 'add_custom_style'") ||
  !actionsSource.includes('makeCustomStyleFromRequest') ||
  !actionsSource.includes("type: 'ADD_CUSTOM_STYLE'") ||
  !actionsSource.includes('add_custom_style creates and selects a custom style preset');
const missingStructuredListSupport = [
  'set_masterplan_zones',
  'set_exploded_components',
  'set_section_areas',
  'set_multi_angle_points',
].filter((action) => !actionsSource.includes(`| '${action}'`) || !actionsSource.includes(`request.type === '${action}'`) || !actionsSource.includes(`action.type === '${action}'`));
const missingImageHandlers = requiredImageTargets.filter((target) => !actionsSource.includes(`case '${target}'`));
const missingFileTargets = requiredFileTargets.filter((target) => !fileTargets.includes(target));
const missingFileHandlers = requiredFileTargets.filter((target) => !actionsSource.includes(`case '${target}'`));
const missingProjectImportSupport =
  !actionsSource.includes("fileTarget === 'project-import'") ||
  !actionsSource.includes("type: 'LOAD_PROJECT'") ||
  !actionsSource.includes('parseProjectStateFile') ||
  !assistantSource.includes('.json,application/pdf,application/json');
const missingAssistantTestHook =
  !assistantSource.includes('__ARCHWIZ_ASSISTANT_TEST_HOOKS__') ||
  !assistantSource.includes('isAppAssistantTestBridgeEnabled') ||
  !assistantSource.includes('normalizeRequests') ||
  !assistantSource.includes('applyRequests') ||
  !assistantSource.includes('archwiz:test-assistant-command') ||
  !assistantSource.includes('data-archwiz-assistant-test-result') ||
  !assistantSource.includes('archwizAssistantSmoke') ||
  !assistantSource.includes('data-archwiz-assistant-smoke') ||
  !assistantSource.includes('archwizAssistantSubmitSmoke') ||
  !assistantSource.includes('data-archwiz-assistant-submit-smoke') ||
  !assistantSource.includes('data-archwiz-assistant-submit-service') ||
  !assistantSource.includes('data-archwiz-assistant-live-diagnostics') ||
  !assistantSource.includes('liveDiagnostics: getGatewaySessionDiagnostics()') ||
  !assistantSource.includes('Current status:') ||
  !assistantSource.includes('getAssistantSubmitSmokeAnswer') ||
  !assistantSource.includes('Submit smoke response applied through the normal assistant parser.') ||
  !assistantSource.includes('batchActionTypes') ||
  !assistantSource.includes("'batch-wait'") ||
  !assistantSource.includes("'helpers-wait'") ||
  !assistantSource.includes('data-archwiz-assistant-helper-trigger') ||
  !assistantSource.includes('data-archwiz-assistant-generation-trigger') ||
  !assistantSource.includes('data-archwiz-assistant-download-trigger') ||
  !assistantSource.includes("{ type: 'run_generation'") ||
  !assistantSource.includes("{ type: 'download_current_image'") ||
  !assistantSource.includes("imageTarget: 'video-start-frame'") ||
  !assistantSource.includes("imageTarget: 'video-end-frame'") ||
  !assistantSource.includes("imageTarget: 'headshot-right'") ||
  !assistantSource.includes("fileTarget: 'material-validation-document', attachmentId: 'mat2'") ||
  !assistantSource.includes("fileTarget: 'pdf-compression-queue', attachmentId: 'pdf2'") ||
  !assistantSource.includes('state.workflow.sceneInsertionReferences.length === 2') ||
  !assistantSource.includes('state.workflow.pdfCompression.queue.length === 2') ||
  !assistantSource.includes("{ type: 'run_preprocess'") ||
  !assistantSource.includes("{ type: 'run_masterplan_zone_detection'") ||
  !assistantSource.includes("{ type: 'run_exploded_component_detection'") ||
  !assistantSource.includes("{ type: 'run_section_area_detection'") ||
  !storeSource.includes('archwiz:test-store-command') ||
  !storeSource.includes('data-archwiz-test-result') ||
  !assistantSource.includes('normalizeAppAssistantActions(requests, state, options)') ||
  !assistantSource.includes('applyActions(`assistant-test-');
const missingGlobalAssistantThread =
  assistantSource.includes('AssistantThreads') ||
  assistantSource.includes('threads[state.mode]') ||
  assistantSource.includes('setThreadForMode') ||
  !assistantSource.includes('const [messages, setMessages] = useState<AssistantMessage[]>([]);') ||
  !assistantSource.includes('const requestMessages = messages') ||
  !assistantSource.includes('setMessages((items) => [...items, userMessage, loadingMessage])');
const missingCommandActions = requiredCommandActions.filter((action) => !actionsSource.includes(`| '${action}'`));
const missingCleanupSupport = requiredCleanupActions.filter((action) => (
  !actionsSource.includes(`| '${action}'`) ||
  !actionsSource.includes(`request.type === '${action}'`) ||
  !actionsSource.includes(`action.type === '${action}'`)
));
const missingCleanupTargetCoverage =
  !actionsSource.includes('getClearImageTargetLabel') ||
  !actionsSource.includes('getClearFileTargetLabel') ||
  !actionsSource.includes('filterOptionalIdentifier') ||
  !actionsSource.includes('clear_image_target removes an image/reference') ||
  !actionsSource.includes('clear_file_target removes files');
const missingBatchMutationSupport =
  !actionsSource.includes('MAX_ASSISTANT_ACTIONS_PER_RESPONSE = 16') ||
  !actionsSource.includes('readObjectPath') ||
  !actionsSource.includes('readArrayPath') ||
  actionsSource.includes('...state.workflow.sceneInsertionReferences,\n            {') ||
  actionsSource.includes('...state.workflow.sketchRefs,\n            {') ||
  actionsSource.includes('...state.workflow.videoState.keyframes,') ||
  actionsSource.includes('...state.materialValidation.documents,') ||
  actionsSource.includes('...state.workflow.pdfCompression.queue,');
const missingGatewayDiagnostics =
  !apiGatewaySource.includes('GatewaySessionDiagnostics') ||
  !apiGatewaySource.includes('getGatewaySessionDiagnostics') ||
  !apiGatewaySource.includes('hasConfiguredGatewayUrl') ||
  !apiGatewaySource.includes('hasStoredSession') ||
  !apiGatewaySource.includes('authenticated') ||
  !apiGatewaySource.includes('expiresInMs');
const missingCommandHandlers = requiredCommandActions.filter((action) => {
  if (action === 'cancel_generation') {
    return !assistantSource.includes("action.type === 'cancel_generation'") || !assistantSource.includes('cancelGeneration()');
  }
  if (action === 'run_ai_selection') {
    return (
      !assistantSource.includes("action.type === 'run_ai_selection'") ||
      !assistantSource.includes('archviz:assistant-run-visual-ai-selection') ||
      !visualEditSource.includes('archviz:assistant-run-visual-ai-selection') ||
      !visualEditSource.includes('runAutoSelection(validTargets)')
    );
  }
  if (action === 'run_preprocess') {
    return (
      !assistantSource.includes('runPreprocessAction') ||
      !assistantSource.includes('archviz:assistant-run-render3d-preprocess') ||
      !leftRender3dSource.includes('archviz:assistant-run-render3d-preprocess') ||
      !leftRender3dSource.includes('handleProblemAreaAnalysis()')
    );
  }
  if (action === 'run_image_to_cad_preprocess') {
    return (
      !assistantSource.includes("action.type === 'run_image_to_cad_preprocess'") ||
      !assistantSource.includes('archviz:assistant-run-image-to-cad-preprocess') ||
      !leftImageToCadSource.includes('archviz:assistant-run-image-to-cad-preprocess') ||
      !leftImageToCadSource.includes('handlePreprocess')
    );
  }
  if (action === 'run_masterplan_zone_detection') {
    return (
      !assistantSource.includes("action.type === 'run_masterplan_zone_detection'") ||
      !assistantSource.includes('archviz:assistant-run-masterplan-zone-detection') ||
      !leftMasterplanSource.includes('archviz:assistant-run-masterplan-zone-detection') ||
      !leftMasterplanSource.includes('handleAutoDetectZones')
    );
  }
  if (action === 'run_exploded_component_detection') {
    return (
      !assistantSource.includes("action.type === 'run_exploded_component_detection'") ||
      !assistantSource.includes('archviz:assistant-run-exploded-component-detection') ||
      !leftExplodedSource.includes('archviz:assistant-run-exploded-component-detection') ||
      !leftExplodedSource.includes('handleAutoDetectComponents')
    );
  }
  if (action === 'run_section_area_detection') {
    return (
      !assistantSource.includes("action.type === 'run_section_area_detection'") ||
      !assistantSource.includes('archviz:assistant-run-section-area-detection') ||
      !leftSectionSource.includes('archviz:assistant-run-section-area-detection') ||
      !leftSectionSource.includes('handleAutoDetectAreas')
    );
  }
  if (action === 'reset_project') {
    return !actionsSource.includes("action.type === 'reset_project'") || !actionsSource.includes("type: 'RESET_PROJECT'");
  }
  if (action === 'set_language') {
    return !actionsSource.includes("request.type === 'set_language'") || !assistantSource.includes('i18n.changeLanguage');
  }
  if (action === 'open_feedback_report') {
    return (
      !actionsSource.includes("request.type === 'open_feedback_report'") ||
      !assistantSource.includes('archviz:assistant-open-feedback-report') ||
      !topBarSource.includes('archviz:assistant-open-feedback-report') ||
      !topBarSource.includes('setShowFeedbackDialog(true)')
    );
  }
  if (action === 'open_feedback_admin') {
    return (
      !actionsSource.includes("request.type === 'open_feedback_admin'") ||
      !assistantSource.includes('archviz:assistant-open-feedback-admin') ||
      !topBarSource.includes('archviz:assistant-open-feedback-admin') ||
      !topBarSource.includes('setShowAdminDashboard(true)')
    );
  }
  if (action === 'open_docs') {
    return !actionsSource.includes("request.type === 'open_docs'") || !assistantSource.includes("window.location.assign('/docs/')");
  }
  if (action === 'sign_out') {
    return (
      !actionsSource.includes("request.type === 'sign_out'") ||
      !assistantSource.includes('archviz:assistant-sign-out') ||
      !topBarSource.includes('archviz:assistant-sign-out') ||
      !topBarSource.includes('logout()')
    );
  }
  if (action === 'undo_selection_change' || action === 'redo_selection_change') {
    return (
      !actionsSource.includes(`request.type === '${action}'`) ||
      !actionsSource.includes(`action.type === '${action}'`) ||
      !actionsSource.includes('visualSelectionUndoStack') ||
      !actionsSource.includes('visualSelectionRedoStack') ||
      !actionsSource.includes('mpBoundaryUndoStack') ||
      !actionsSource.includes('mpBoundaryRedoStack')
    );
  }
  return false;
});

const failures = [
  missingImageTargets.length ? `Missing image targets: ${missingImageTargets.join(', ')}` : null,
  missingImageHandlers.length ? `Missing image target handlers: ${missingImageHandlers.join(', ')}` : null,
  missingFileTargets.length ? `Missing file targets: ${missingFileTargets.join(', ')}` : null,
  missingFileHandlers.length ? `Missing file target handlers: ${missingFileHandlers.join(', ')}` : null,
  missingProjectImportSupport ? 'Missing project import support for attached JSON files' : null,
  missingAssistantTestHook ? 'Missing gated assistant action execution test hook' : null,
  missingGlobalAssistantThread ? 'Missing global assistant chat thread support' : null,
  missingDownloadActions.length ? `Missing download actions: ${missingDownloadActions.join(', ')}` : null,
  missingDownloadHandlers.length ? `Missing download handlers: ${missingDownloadHandlers.join(', ')}` : null,
  missingCurrentImageDownloadOptions ? 'Missing current-image download format/resolution support' : null,
  missingMaterialValidationReportExport ? 'Missing Material Validation report export support' : null,
  missingCustomStyleSupport ? 'Missing custom style creation support' : null,
  missingStructuredListSupport.length ? `Missing structured list support: ${missingStructuredListSupport.join(', ')}` : null,
  missingCleanupSupport.length ? `Missing cleanup action support: ${missingCleanupSupport.join(', ')}` : null,
  missingCleanupTargetCoverage ? 'Missing image/file cleanup target coverage' : null,
  missingBatchMutationSupport ? 'Missing batch-safe assistant upload/cleanup mutation support' : null,
  missingGatewayDiagnostics ? 'Missing safe assistant gateway/session diagnostics' : null,
  missingWorkflowModePrefixes.length ? `Missing workflow mode prefix maps: ${missingWorkflowModePrefixes.join(', ')}` : null,
  missingWorkflowModeCoverage.length ? `Settable workflow paths missing mode coverage: ${missingWorkflowModeCoverage.join(', ')}` : null,
  missingCommandActions.length ? `Missing command actions: ${missingCommandActions.join(', ')}` : null,
  missingCommandHandlers.length ? `Missing command handlers: ${missingCommandHandlers.join(', ')}` : null,
].filter(Boolean);

if (failures.length) {
  console.error('Assistant integration verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Assistant integration verification passed.');
console.log(`Workflow leaves: ${workflowLeaves.length}`);
console.log(`Settable workflow leaves: ${settableWorkflowLeaves.length}`);
console.log(`Curated workflow descriptors: ${manualWorkflowPaths.size}`);
console.log(`Dynamic settable workflow leaves: ${dynamicWorkflowLeaves.length}`);
console.log(`Protected runtime/upload/generated leaves: ${protectedWorkflowLeaves.length}`);
console.log(`Image targets: ${imageTargets.length}`);
console.log(`File targets: ${fileTargets.length}`);
console.log(`Download actions: ${downloadActions.length}`);
