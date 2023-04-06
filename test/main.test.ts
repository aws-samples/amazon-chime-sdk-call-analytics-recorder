import { App } from 'aws-cdk-lib';
import { AmazonChimeSDKCallAnalyticsRecording } from '../src/amazon-chime-sdk-call-analytics-recording';

const stackProps = {
  outputBucket: '',
  recordingBucketPrefix: '',
  buildAsterisk: '',
  sipRecCidrs: '',
  logLevel: '',
  removalPolicy: '',
};

test('IncludedBucket', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...stackProps,
    recordingBucketPrefix: 'test',
  });
});

test('GoodCIDR', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'GoodCIDR', {
    ...stackProps,
    sipRecCidrs: '198.51.100.0/27',
  });
});

test('AsteriskAndLogLevels', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'AsteriskAndLogLevels', {
    ...stackProps,
    buildAsterisk: 'true',
    logLevel: 'DEBUG',
  });
});

test('RETAIN', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'RETAIN', {
    ...stackProps,
    removalPolicy: 'RETAIN',
  });
});

test('DESTROY', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'DESTROY', {
    ...stackProps,
    removalPolicy: 'DESTROY',
  });
});

test('SNAPSHOT', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'SNAPSHOT', {
    ...stackProps,
    removalPolicy: 'SNAPSHOT',
  });
});

test('GoodCIDRs', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'GoodCIDRs', {
    ...stackProps,
    sipRecCidrs: '198.51.100.0/27,198.51.100.128/28',
  });
});

test('TooManyCIDRs', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'TooManyCIDRs', {
      ...stackProps,
      sipRecCidrs:
        '198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28,198.51.100.0/27,198.51.100.128/28',
    });
  }).toThrow('SIPREC_CIDRS must not contain more than 10 CIDRs');
});

test('PrivateCIDR', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'PrivateCIDR', {
      ...stackProps,
      sipRecCidrs: '10.10.10.10/32',
    });
  }).toThrow(
    'CIDR block 10.10.10.10/32 contains an RFC 1918 private IP address',
  );
});

test('BADCIDR', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadCIDR', {
      ...stackProps,
      sipRecCidrs: 'bad',
    });
  }).toThrow('Invalid CIDR block: bad');
});

test('BadLogLevel', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadLogLevel', {
      ...stackProps,
      logLevel: 'bad',
    });
  }).toThrow('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
});

test('BadRemovalPolicy', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadRemovalPolicy', {
      ...stackProps,
      removalPolicy: 'bad',
    });
  }).toThrow('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
});

test('BadBuildAsterisk', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadBuildAsterisk', {
      ...stackProps,
      buildAsterisk: 'bad',
    });
  }).toThrow('BUILD_ASTERISK must be true or false');
});

test('AsteriskAndSIPREC', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'AsteriskAndSIPREC', {
      ...stackProps,
      buildAsterisk: 'true',
      sipRecCidrs: '198.51.100.0/27',
    });
  }).toThrow('BUILD_ASTERISK and SIPREC_CIDRS cannot both be true');
});
