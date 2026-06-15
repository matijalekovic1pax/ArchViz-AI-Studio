
import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { SegmentedControl } from '../../ui/SegmentedControl';

export const LeftImageToCADPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   const updateWf = useCallback(
      (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
      [dispatch]
   );

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Image Setup" />
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-foreground-muted mb-2 block">Image Type</label>
                  <SegmentedControl 
                     value={wf.imgToCadType}
                     options={[{label: 'Photo', value: 'photo'}, {label: 'Render', value: 'render'}]}
                     onChange={(v) => updateWf({ imgToCadType: v })}
                  />
               </div>
            </div>
         </div>
      </div>
   );
};
