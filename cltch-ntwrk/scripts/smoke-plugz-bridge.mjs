import { readFile } from 'node:fs/promises';

const checks = [
  {
    file: 'functions/index.js',
    patterns: [
      'const PLUGZ_TERMS_VERSION',
      'acceptedTermsVersion !== PLUGZ_TERMS_VERSION',
      "db.collection('plugzBridgeClaims')",
      "db.collection('plugzBridgeEvents')",
      'buildPlugzImportedProfile',
      'This Plugz account is already connected to another CLTCH account.'
    ]
  },
  {
    file: 'app/plugz-bridge.js',
    patterns: [
      'export const PLUGZ_TERMS_VERSION',
      'acceptedTerms !== true',
      'activatePlugzMembershipForCurrentCltchUser',
      'finishPendingPlugzProfileActivation',
      'PLUGZ_PENDING_PROFILE_KEY',
      'cltchIdToken'
    ]
  },
  {
    file: 'auth.html',
    patterns: [
      'siPlugzTerms',
      'suPlugzTerms',
      'terms.html#plugz-membership',
      'Accept the CLTCH Plugz membership terms before continuing.'
    ]
  },
  {
    file: 'musician-profile.html',
    patterns: [
      'Plugz Member Access',
      'plugzMembershipTerms',
      'allow CLTCH to import and auto-save',
      'finishPendingPlugzProfileActivation(auth)',
      'activatePlugzMembershipForCurrentCltchUser(auth, \'musician\', { acceptedTerms: true })'
    ]
  },
  {
    file: 'host-profile.html',
    patterns: [
      'Plugz Member Access',
      'plugzMembershipTerms',
      'allow CLTCH to import and auto-save',
      'finishPendingPlugzProfileActivation(auth)',
      'activatePlugzMembershipForCurrentCltchUser(auth, \'host\', { acceptedTerms: true })'
    ]
  },
  {
    file: 'firestore.rules',
    patterns: [
      'plugzTermsAccepted',
      'plugzImportedEmail',
      'match /plugzBridgeClaims/{plugzUid}',
      'match /plugzBridgeEvents/{eventId}'
    ]
  },
  {
    file: 'terms.html',
    patterns: [
      'id="plugz-membership"',
      'import and auto-save the Plugz account information',
      'one Plugz account to one CLTCH membership grant'
    ]
  }
];

let failures = 0;

for (const check of checks) {
  const text = await readFile(check.file, 'utf8');
  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) {
      failures += 1;
      console.error(`Missing pattern in ${check.file}: ${pattern}`);
    }
  }
}

if (failures) {
  console.error(`Plugz bridge smoke failed with ${failures} missing pattern(s).`);
  process.exit(1);
}

console.log('Plugz bridge smoke passed.');
