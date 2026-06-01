import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { useGeneration } from '../../../hooks/useGeneration';
import { FrameAngleController, type FrameAngleValue } from '../../frame-angle/FrameAngleController';
import { clampFrameAngleValue } from '../../frame-angle/frameAngleUtils';
import type { WorkflowSettings } from '../../../types';

export const AngleChangePanel = () => {
  const { state, dispatch } = useAppStore();
  const { generate } = useGeneration();

  const updateWf = useCallback(
    (payload: Partial<WorkflowSettings>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch]
  );

  const frameAngle = clampFrameAngleValue({
    angleDeg: state.workflow.angleChangeDegrees,
    tiltDeg: state.workflow.angleChangePitch,
  });

  const handleChange = useCallback(
    (value: FrameAngleValue) => {
      const next = clampFrameAngleValue(value);
      updateWf({
        angleChangeDegrees: next.angleDeg,
        angleChangePitch: next.tiltDeg,
      });
    },
    [updateWf]
  );

  const handleGenerate = useCallback(
    async (value: FrameAngleValue) => {
      handleChange(value);
      await generate();
    },
    [generate, handleChange]
  );

  return (
    <FrameAngleController
      imageUrl={state.sourceImage || state.uploadedImage || ''}
      value={frameAngle}
      onChange={handleChange}
      onGenerate={handleGenerate}
      disabled={!state.uploadedImage || state.isGenerating}
    />
  );
};
