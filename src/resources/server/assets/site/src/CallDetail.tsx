import React from 'react';
import { Tabs } from '@cloudscape-design/components';
import { Call } from './CallContext';
import { SummaryTable } from './SummaryTable';
import { Transcription } from './Transcription';
import AudioPlayer from './AudioPlayer';

type CallDetailProps = {
  selectedCall: Call | undefined;
};

export const CallDetail: React.FC<CallDetailProps> = ({ selectedCall }) => {
  return (
    <div>
      <Tabs
        tabs={[
          {
            label: 'Transcription',
            id: 'transcription',
            content: (
              <Transcription transactionId={selectedCall?.transactionId} />
            ),
          },
          {
            label: 'Queries',
            id: 'queries',
            content: (
              <SummaryTable transactionId={selectedCall?.transactionId} />
            ),
          },
          {
            label: 'Recording',
            id: 'recording',
            content: (
              <AudioPlayer transactionId={selectedCall?.transactionId} />
            ),
          },
        ]}
      />
    </div>
  );
};
