import React, { useEffect, useState, useContext } from 'react';
import { Container } from '@cloudscape-design/components';
import { Storage } from 'aws-amplify';
import { CallContext } from './CallContext';

type AudioPlayerProps = {
  transactionId: string | undefined;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ transactionId }) => {
  const [audioSrc, setAudioSrc] = useState<string>('');
  const { calls } = useContext(CallContext);

  useEffect(() => {
    const fetchAudioFile = async () => {
      try {
        if (transactionId) {
          const currentCall = calls.find(
            (call) => call.transactionId === transactionId,
          );
          if (currentCall && currentCall.wavFile) {
            const url = await Storage.get(currentCall.wavFile, {
              level: 'public',
            });
            setAudioSrc(url);
          }
        }
      } catch (error) {
        console.error('Error fetching audio file:', error);
      }
    };

    fetchAudioFile();
  }, [transactionId, calls]);

  return (
    <Container header='Recording'>
      {audioSrc ? (
        <audio id='audio-player' controls>
          <source src={audioSrc} type='audio/wav' />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <div>Loading audio...</div>
      )}
    </Container>
  );
};

export default AudioPlayer;
