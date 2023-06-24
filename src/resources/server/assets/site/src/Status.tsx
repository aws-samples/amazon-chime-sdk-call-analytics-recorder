import React, { useEffect, useState } from 'react';
import {
  Box,
  ColumnLayout,
  Container,
  Header,
  StatusIndicator,
  SpaceBetween,
  Button,
} from '@cloudscape-design/components';

const PHONE_NUMBER = process.env.PHONE_NUMBER || '+1 (555) 555-5555';
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

const getEndpointStatusType = (status: string) => {
  switch (status) {
    case 'OutOfService':
    case 'Failed':
      return 'error';
    case 'Deleting':
    case 'Creating':
    case 'Updating':
    case 'SystemUpdating':
    case 'RollingBack':
      return 'in-progress';
    case 'InService':
      return 'success';
    case 'Unknown':
      return 'info';
    case 'UpdatingRollbackFailed':
      return 'warning';
    default:
      return 'info';
  }
};

export const Status = () => {
  const [endpointStatus, setEndpointStatus] = useState('Unknown');

  useEffect(() => {
    const fetchEndpointStatus = async () => {
      try {
        const response = await fetch(`${API_GATEWAY_URL}/action`, {
          method: 'POST',
          body: JSON.stringify({ action: 'query' }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          setEndpointStatus(data.message);
        } else {
          // Handle error
        }
      } catch (error) {
        // Handle error
      }
    };

    fetchEndpointStatus();

    const intervalId = setInterval(fetchEndpointStatus, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const startEndpoint = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setEndpointStatus('Creating');
      } else {
        // Handle error
      }
    } catch (error) {
      // Handle error
    }
  };

  const stopEndpoint = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setEndpointStatus('Deleting');
      } else {
        // Handle error
      }
    } catch (error) {
      // Handle error
    }
  };

  const renderButton = () => {
    if (endpointStatus === 'InService') {
      return (
        <Button onClick={stopEndpoint} variant='primary'>
          Stop Endpoint
        </Button>
      );
    } else {
      return (
        <Button onClick={startEndpoint} variant='primary'>
          Start Endpoint
        </Button>
      );
    }
  };

  return (
    <Container
      header={
        <Header
          variant='h3'
          actions={
            <SpaceBetween direction='horizontal' size='xs'>
              {renderButton()}
            </SpaceBetween>
          }
        >
          Demo configuration
        </Header>
      }
    >
      <ColumnLayout columns={3} variant='text-grid'>
        <div>
          <Box variant='awsui-key-label'>Phone Number</Box>
          <div>{PHONE_NUMBER}</div>
        </div>
        <div>
          <Box variant='awsui-key-label'>Endpoint Status</Box>
          <StatusIndicator type={getEndpointStatusType(endpointStatus)}>
            {endpointStatus}
          </StatusIndicator>
        </div>
      </ColumnLayout>
    </Container>
  );
};
