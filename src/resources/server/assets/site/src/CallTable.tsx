import React, { useContext, useState } from 'react';
import { CallDetail } from './CallDetail';
import { CallContext } from './CallContext';
import { SpaceBetween, Table } from '@cloudscape-design/components';
import { Call } from './CallContext';

const columnDefinitions = [
  {
    id: 'transactionId',
    header: 'Transaction ID',
    cell: (item: Call) => item.transactionId,
    sortingField: 'transactionId',
    isRowHeader: true,
  },
  {
    id: 'fromNumber',
    header: 'From Number',
    cell: (item: Call) => item.fromNumber,
    sortingField: 'fromNumber',
    isRowHeader: true,
  },
  {
    id: 'toNumber',
    header: 'To Number',
    cell: (item: Call) => item.toNumber,
    sortingField: 'toNumber',
    isRowHeader: true,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (item: Call) => item.status,
    sortingField: 'status',
    isRowHeader: true,
  },
  {
    id: 'callStartTime',
    header: 'Call Start Time',
    cell: (item: Call) => item.callStartTime,
    sortingField: 'callStartTime',
    isRowHeader: true,
  },
  {
    id: 'callEndTime',
    header: 'Call End Time',
    cell: (item: Call) => item.callEndTime,
    sortingField: 'callEndTime',
    isRowHeader: true,
  },
];

const CallTable: React.FC = () => {
  const callContext = useContext(CallContext);
  const { calls } = callContext;
  const [selectedItems, setSelectedItems] = useState<Call[]>([]);

  const items = calls.map((call) => ({
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
    <SpaceBetween size='xl'>
      <Table
        header='Calls'
        selectedItems={selectedItems}
        items={items}
        stickyHeader
        selectionType='single'
        trackBy='transactionId'
        wrapLines
        variant='container'
        sortingDisabled={true}
        contentDensity='compact'
        onSelectionChange={(event) =>
          setSelectedItems(event.detail.selectedItems)
        }
        columnDefinitions={columnDefinitions}
      />
      {selectedItems && selectedItems.length > 0 && (
        <CallDetail selectedCall={selectedItems[0]} />
      )}
    </SpaceBetween>
  );
};

export default CallTable;
