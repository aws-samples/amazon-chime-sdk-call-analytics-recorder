import React, { useContext, useState } from 'react';
import { Modal, Tabs, Table } from '@cloudscape-design/components';
import { CallContext, Call } from './CallContext';
import { SummaryTable } from './SummaryTable';
import { Transcription } from './Transcription';
import CallTable from './CallTable';

export const CallDetail = () => {
  const callContext = useContext(CallContext);
  const { calls } = callContext;
  const [visible, setVisible] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | undefined>(undefined);

  const handleCallClick = (call: Call) => {
    setVisible(true);
    setSelectedCall(call);
  };
  console.info(`Selected Call: ${JSON.stringify(selectedCall)}`);
  console.info(
    `Selected Call Queries: ${JSON.stringify(selectedCall?.queries)}`,
  );
  return (
    <div>
      <CallTable data={calls} onCallClick={handleCallClick} />

      <Modal
        onDismiss={() => setVisible(false)}
        visible={visible}
        size='max'
        header='Call Details'
      >
        <CallTable
          data={selectedCall ? [selectedCall] : []}
          onCallClick={() => {}}
        />
        <Tabs
          tabs={[
            {
              label: 'Transcription',
              id: 'transcription',
              content: (
                <Transcription transcription={selectedCall?.transcription} />
              ),
            },
            {
              label: 'Queries',
              id: 'queries',
              content: <SummaryTable queries={selectedCall?.queries} />,
            },
          ]}
        />
      </Modal>
    </div>
  );
};
