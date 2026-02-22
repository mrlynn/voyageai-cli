'use strict';

/**
 * Welcome / first-run wizard step definitions.
 *
 * Surface-agnostic, consumed by CLI (via wizard-cli.js renderer),
 * and potentially Playground or Desktop in the future.
 */

const welcomeSteps = [
  {
    id: 'apiKey',
    label: 'Voyage AI API key',
    type: 'password',
    required: true,
    placeholder: 'pa-... or al-...',
    validate: (value) => {
      if (!value || value.trim().length < 10) {
        return 'API key looks too short. Get one at https://dash.voyageai.com/api-keys';
      }
      return true;
    },
    group: 'Setup',
  },

  {
    id: 'wantMongo',
    label: 'Configure a MongoDB connection? (for vai store/search/chat)',
    type: 'confirm',
    defaultValue: false,
    group: 'Setup',
  },

  {
    id: 'mongodbUri',
    label: 'MongoDB connection URI',
    type: 'password',
    required: false,
    placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/mydb',
    skip: (answers) => !answers.wantMongo,
    validate: (value) => {
      if (value && !value.startsWith('mongodb')) {
        return 'URI should start with mongodb:// or mongodb+srv://';
      }
      return true;
    },
    group: 'Setup',
  },
];

module.exports = { welcomeSteps };
