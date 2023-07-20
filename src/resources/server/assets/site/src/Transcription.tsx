import React, { useContext, useState, useEffect } from 'react';
import { CallContext } from './CallContext';
import { Table } from '@cloudscape-design/components';

type TranscriptionProps = {
  transactionId: string | undefined;
};

export const Transcription: React.FC<TranscriptionProps> = ({
  transactionId,
}) => {
  const { calls, addQueryToCall } = useContext(CallContext);
  const [parsedTranscription, setParsedTranscription] = useState<
    { speaker_label: string; words: string }[]
  >([]);

  useEffect(() => {
    console.log(`transactionId: ${transactionId}`);
    if (transactionId) {
      const currentCall = calls.find(
        (call) => call.transactionId === transactionId,
      );

      if (currentCall) {
        console.log(`currentCall: ${JSON.stringify(currentCall)}`);
        if (currentCall.transcription) {
          const transcription = JSON.parse(currentCall.transcription);
          setParsedTranscription(transcription);
        }
      }
    }
  }, [transactionId, calls]);

  return (
    <Table
      header='Transcription'
      columnDefinitions={[
        {
          id: 'speaker',
          header: 'Speaker',
          cell: (item) => item.speaker_label,
          isRowHeader: true,
        },
        {
          id: 'words',
          header: 'Transcription',
          cell: (item) => item.words,
          isRowHeader: true,
        },
      ]}
      items={parsedTranscription}
      stickyHeader
      wrapLines
      variant='container'
      contentDensity='compact'
    />
  );
};
