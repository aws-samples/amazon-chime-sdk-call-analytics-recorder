import React from 'react';
import { Table } from '@cloudscape-design/components';

type SummaryTableProps = {
  queries: string[] | undefined;
};

export const SummaryTable: React.FC<SummaryTableProps> = ({ queries }) => {
  let parsedQueries: { prompt: string; response: string }[] = [];

  if (queries) {
    try {
      parsedQueries = queries.map((query) => JSON.parse(query));
    } catch (error) {
      console.error('Failed to parse queries:', error);
    }
  }

  console.log(`Queries: ${JSON.stringify(parsedQueries, null, 2)}\n`);

  return (
    <Table
      header='Queries'
      columnDefinitions={[
        {
          id: 'prompt',
          header: 'Prompt',
          cell: (item) => item.prompt,
          isRowHeader: true,
        },
        {
          id: 'response',
          header: 'Response',
          cell: (item) => item.response,
          isRowHeader: true,
        },
      ]}
      items={parsedQueries}
      stickyHeader
      wrapLines
      variant='container'
      contentDensity='compact'
    />
  );
};
