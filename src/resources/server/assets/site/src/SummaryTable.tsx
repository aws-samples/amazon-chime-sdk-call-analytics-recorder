import React, { useState, useContext, useEffect } from 'react';
import {
  Container,
  Table,
  Header,
  Input,
  Button,
  SpaceBetween,
} from '@cloudscape-design/components';
import './styles.css';
import { CallContext } from './CallContext';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

type SummaryTableProps = {
  transactionId: string | undefined;
};

export const SummaryTable: React.FC<SummaryTableProps> = ({
  transactionId,
}) => {
  const [query, setQuery] = useState('');
  const { calls, addQueryToCall } = useContext(CallContext);
  const [parsedQueries, setParsedQueries] = useState<
    { prompt: string; response: string }[]
  >([]);

  const handleNewQuery = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query, transactionId: transactionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to make a new query');
      }

      const data = await response.json();
      setQuery('');
    } catch (error) {
      console.error('Failed to make a new query:', error);
    }
  };

  useEffect(() => {
    console.log(`transactionId: ${transactionId}`);
    if (transactionId) {
      const currentCall = calls.find(
        (call) => call.transactionId === transactionId,
      );

      if (currentCall) {
        console.log(`currentCall: ${JSON.stringify(currentCall)}`);
        if (currentCall.queries) {
          const queries = JSON.parse(currentCall.queries);
          setParsedQueries(queries);
        }
      }
    }
  }, [transactionId, calls]);

  return (
    <Container header={<Header>Summaries</Header>}>
      <SpaceBetween direction='horizontal' size='s'>
        <Input
          className='input-wrapper'
          onChange={({ detail }) => setQuery(detail.value)}
          value={query}
        />
        <Button onClick={handleNewQuery}>New Query</Button>
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
          variant='stacked'
          contentDensity='compact'
        />
      </SpaceBetween>
    </Container>
  );
};
