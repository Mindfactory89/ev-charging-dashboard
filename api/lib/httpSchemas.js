'use strict';

const YEAR_SCHEMA = {
  type: 'integer',
  minimum: 2000,
  maximum: 2100,
};

const YEAR_QUERY_REQUIRED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['year'],
  properties: {
    year: YEAR_SCHEMA,
  },
};

const YEAR_QUERY_OPTIONAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    year: YEAR_SCHEMA,
  },
};

const SESSION_ID_PARAMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
};

const SESSION_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    year: YEAR_SCHEMA,
    limit: { type: 'integer', minimum: 1, maximum: 5000 },
    offset: { type: 'integer', minimum: 0, maximum: 1000000 },
  },
};

const OPTIONAL_STRING_SCHEMA = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const SESSION_MUTATION_PROPERTIES = {
  date: {
    anyOf: [
      { type: 'string', format: 'date-time' },
      { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    ],
  },
  connector: { type: 'string', minLength: 1 },
  provider: OPTIONAL_STRING_SCHEMA,
  location: OPTIONAL_STRING_SCHEMA,
  vehicle: OPTIONAL_STRING_SCHEMA,
  tags: {
    anyOf: [
      { type: 'string' },
      {
        type: 'array',
        items: { type: 'string' },
      },
      { type: 'null' },
    ],
  },
  soc_start: { type: 'integer', minimum: 0, maximum: 100 },
  soc_end: { type: 'integer', minimum: 0, maximum: 100 },
  energy_kwh: { type: 'number', exclusiveMinimum: 0 },
  price_per_kwh: { type: 'number', exclusiveMinimum: 0 },
  duration_hhmm: { anyOf: [{ type: 'string', pattern: '^\\d{1,3}:\\d{2}$' }, { type: 'null' }] },
  duration_seconds: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }] },
  note: OPTIONAL_STRING_SCHEMA,
  odo_start_km: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
  odo_end_km: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
  odometer_km: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
};

const CREATE_SESSION_BODY_SCHEMA = {
  type: 'object',
  required: ['date', 'connector', 'soc_start', 'soc_end', 'energy_kwh', 'price_per_kwh'],
  properties: SESSION_MUTATION_PROPERTIES,
};

const PATCH_SESSION_BODY_SCHEMA = {
  type: 'object',
  minProperties: 1,
  properties: SESSION_MUTATION_PROPERTIES,
};

module.exports = {
  CREATE_SESSION_BODY_SCHEMA,
  PATCH_SESSION_BODY_SCHEMA,
  SESSION_ID_PARAMS_SCHEMA,
  SESSION_QUERY_SCHEMA,
  YEAR_QUERY_OPTIONAL_SCHEMA,
  YEAR_QUERY_REQUIRED_SCHEMA,
  YEAR_SCHEMA,
};
