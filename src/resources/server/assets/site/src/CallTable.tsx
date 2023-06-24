import React from 'react';
import { Button, Table } from '@cloudscape-design/components';
import { Call } from './CallContext';
type CallTableProps = {
  data: Call[];
  onCallClick: (call: Call) => void;
};

const CallTable: React.FC<CallTableProps> = ({ data, onCallClick }) => {
  const items = data.map((call) => ({
    transactionId: call.transactionId,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    callStartTime: call.callStartTime,
    callEndTime: call.callEndTime,
    status: call.status,
    wavFile: call.wavFile,
    transcriptionFile: call.transcriptionFile,
    transcription: call.transcription,
    callId: call.callId,
    queries: call.queries,
  }));

  return (
    <Table
      header='Calls'
      columnDefinitions={[
        {
          id: 'transactionId',
          header: 'Transaction ID',
          cell: (call: Call) => (
            <Button onClick={() => onCallClick(call)} variant='link'>
              {call.transactionId}
            </Button>
          ),
          sortingField: 'transactionId',
          isRowHeader: true,
        },
        {
          id: 'fromNumber',
          header: 'From Number',
          cell: (item) => item.fromNumber,
          sortingField: 'fromNumber',
          isRowHeader: true,
        },
        {
          id: 'toNumber',
          header: 'To Number',
          cell: (item) => item.toNumber,
          sortingField: 'toNumber',
          isRowHeader: true,
        },
        {
          id: 'status',
          header: 'Status',
          cell: (item) => item.status,
          sortingField: 'status',
          isRowHeader: true,
        },
        {
          id: 'callStartTime',
          header: 'Call Start Time',
          cell: (item) => item.callStartTime,
          sortingField: 'callStartTime',
          isRowHeader: true,
        },
        {
          id: 'callEndTime',
          header: 'Call End Time',
          cell: (item) => item.callEndTime,
          sortingField: 'callEndTime',
          isRowHeader: true,
        },
      ]}
      items={items}
      stickyHeader
      wrapLines
      variant='container'
      contentDensity='compact'
    />
  );
};

export default CallTable;
