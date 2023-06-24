import React, {
  createContext,
  useState,
  PropsWithChildren,
  useEffect,
} from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { GraphQLQuery } from '@aws-amplify/api';
import { listCallsQuery } from './graphql/queries';

export type Call = {
  callId: string;
  transactionId: string;
  fromNumber: string;
  toNumber: string;
  callStartTime: string;
  callEndTime: string;
  status: string;
  wavFile: string;
  transcriptionFile: string;
  queries: any[];
};

type ListCallsResponse = {
  listCalls: {
    items: Call[];
  };
};

type CallContextValue = {
  calls: Call[];
  addCall: (call: Call) => void;
  updateCall: (updatedCall: Call) => void;
};

const initialCallContextValue: CallContextValue = {
  calls: [],
  addCall: () => {},
  updateCall: () => {},
};

export const CallContext = createContext(initialCallContextValue);

export const CallProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [calls, setCalls] = useState<Call[]>([]);

  useEffect(() => {
    async function listCalls() {
      const currentCalls = await API.graphql<GraphQLQuery<ListCallsResponse>>({
        query: listCallsQuery,
      });
      if (currentCalls.data) {
        setCalls(currentCalls.data.listCalls.items);
        console.info(
          `Calls: ${JSON.stringify(currentCalls.data.listCalls.items)}`,
        );
      }
    }
    listCalls(); // Fetch the existing calls when the component mounts
  }, []);

  const addCall = (call: Call) => {
    setCalls((prevCalls: Call[]) => [...prevCalls, call]);
  };

  const updateCall = (updatedCall: Call) => {
    setCalls((prevCalls: Call[]) => {
      const updatedCalls = prevCalls.map((call) => {
        if (call.callId === updatedCall.callId) {
          return { ...call, ...updatedCall };
        }
        return call;
      });
      return updatedCalls;
    });
  };

  const callContextValue: CallContextValue = {
    calls,
    addCall,
    updateCall,
  };

  return (
    <CallContext.Provider value={callContextValue}>
      {children}
    </CallContext.Provider>
  );
};
