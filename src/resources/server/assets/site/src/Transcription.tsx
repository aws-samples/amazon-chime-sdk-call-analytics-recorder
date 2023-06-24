import React from 'react';
import { Table } from '@cloudscape-design/components';

type TranscriptionProps = {
  transcription: string | undefined;
};

export const Transcription: React.FC<TranscriptionProps> = ({
  transcription,
}) => {
  console.log('Transcription:', transcription);
  if (!transcription) return null;

  let parsedTranscription: {
    speaker_label: string;
    words: string;
  }[];

  try {
    parsedTranscription = JSON.parse(transcription);
  } catch (error) {
    console.error('Failed to parse transcription:', error);
    return null;
  }

  const tableData = parsedTranscription.map((item) => ({
    speaker: item.speaker_label,
    words: item.words,
  }));

  return (
    <Table
      header='Transcription'
      columnDefinitions={[
        {
          id: 'speaker',
          header: 'Speaker',
          cell: (item) => item.speaker,
          isRowHeader: true,
        },
        {
          id: 'words',
          header: 'Transcription',
          cell: (item) => item.words,
          isRowHeader: true,
        },
      ]}
      items={tableData}
      stickyHeader
      wrapLines
      variant='container'
      contentDensity='compact'
    />
  );
};
