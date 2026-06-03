import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { FrameAngleController, type FrameAngleValue } from '../../frame-angle/FrameAngleController';
import { clampFrameAngleValue } from '../../frame-angle/frameAngleUtils';
import type { WorkflowSettings } from '../../../types';

export const AngleChangePanel = () => {
  const { state, dispatch } = useAppStore();

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

  return (
    <FrameAngleController
      imageUrl={state.sourceImage || state.uploadedImage || ''}
      value={frameAngle}
      onChange={handleChange}
      disabled={!state.uploadedImage || state.isGenerating}
    />
  );
};
