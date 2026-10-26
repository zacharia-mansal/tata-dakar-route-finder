const connectionParameterEnvironment = {
  application_name: 'PGAPPNAME',
  channel_binding: 'PGCHANNELBINDING',
  client_encoding: 'PGCLIENTENCODING',
  connect_timeout: 'PGCONNECT_TIMEOUT',
  dbname: 'PGDATABASE',
  gssdelegation: 'PGGSSDELEGATION',
  gssencmode: 'PGGSSENCMODE',
  gsslib: 'PGGSSLIB',
  host: 'PGHOST',
  hostaddr: 'PGHOSTADDR',
  krbsrvname: 'PGKRBSRVNAME',
  load_balance_hosts: 'PGLOADBALANCEHOSTS',
  options: 'PGOPTIONS',
  passfile: 'PGPASSFILE',
  password: 'PGPASSWORD',
  port: 'PGPORT',
  require_auth: 'PGREQUIREAUTH',
  requirepeer: 'PGREQUIREPEER',
  service: 'PGSERVICE',
  servicefile: 'PGSERVICEFILE',
  sslcert: 'PGSSLCERT',
  sslcertmode: 'PGSSLCERTMODE',
  sslcompression: 'PGSSLCOMPRESSION',
  sslcrl: 'PGSSLCRL',
  sslcrldir: 'PGSSLCRLDIR',
  sslkey: 'PGSSLKEY',
  sslmaxprotocolversion: 'PGSSLMAXPROTOCOLVERSION',
  ssl_min_protocol_version: 'PGSSLMINPROTOCOLVERSION',
  ssl_max_protocol_version: 'PGSSLMAXPROTOCOLVERSION',
  sslmode: 'PGSSLMODE',
  sslnegotiation: 'PGSSLNEGOTIATION',
  sslrootcert: 'PGSSLROOTCERT',
  sslsni: 'PGSSLSNI',
  target_session_attrs: 'PGTARGETSESSIONATTRS',
  user: 'PGUSER',
};

function decodeUrlComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
}

/**
 * Convert a PostgreSQL URL to libpq's documented environment variables.
 * The original URL is never returned or passed to a child process.
 *
 * @param {string | undefined} databaseUrl
 * @param {string} missingMessage
 * @returns {Record<string, string>}
 */
export function getLibpqConnectionEnvironment(databaseUrl, missingMessage) {
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error(missingMessage);
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  const searchParameters = [...parsed.searchParams.entries()];
  const queryValue = (name) => searchParameters.find(([key]) => key === name)?.[1];
  const host = parsed.hostname || queryValue('host');
  const database = parsed.pathname.length > 1
    ? decodeUrlComponent(parsed.pathname.slice(1))
    : queryValue('dbname');

  if (!host || !database) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  const connectionEnvironment = {
    PGHOST: host.replace(/^\[|\]$/g, ''),
    PGDATABASE: database,
  };

  if (parsed.port) connectionEnvironment.PGPORT = parsed.port;
  if (parsed.username) connectionEnvironment.PGUSER = decodeUrlComponent(parsed.username);
  if (parsed.password) connectionEnvironment.PGPASSWORD = decodeUrlComponent(parsed.password);

  for (const [key, value] of searchParameters) {
    if (['host', 'port', 'dbname', 'user', 'password'].includes(key)) {
      const parameterEnvironment = connectionParameterEnvironment[key];
      connectionEnvironment[parameterEnvironment] = value;
      continue;
    }

    if (key === 'ssl') {
      if (value.toLowerCase() !== 'true') {
        throw new Error('DATABASE_URL contains an unsupported PostgreSQL connection option.');
      }
      connectionEnvironment.PGSSLMODE = 'require';
      continue;
    }

    const environmentName = connectionParameterEnvironment[key];
    if (!environmentName) {
      throw new Error('DATABASE_URL contains an unsupported PostgreSQL connection option.');
    }
    connectionEnvironment[environmentName] = value;
  }

  return connectionEnvironment;
}

/**
 * Keep subprocess environments limited to libpq connection settings and the
 * operating-system variables needed to locate and launch the client tools.
 *
 * @param {Record<string, string>} connectionEnvironment
 * @param {NodeJS.ProcessEnv} [sourceEnvironment]
 * @returns {Record<string, string>}
 */
export function getLibpqProcessEnvironment(connectionEnvironment, sourceEnvironment = process.env) {
  const childEnvironment = {};
  for (const name of ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'PERL5LIB']) {
    const value = sourceEnvironment[name];
    if (value) childEnvironment[name] = value;
  }
  return { ...childEnvironment, ...connectionEnvironment };
}
