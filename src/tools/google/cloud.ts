import { google } from 'googleapis';
import { ToolModule } from '../base.js';
import { getAuthClient } from './auth.js';

const ACCOUNT_ID_PROP = {
  accountId: {
    type: 'string',
    description: 'Google account to use (e.g. "work", "personal"). Defaults to primary account.',
  },
} as const;

function resolveProject(input: Record<string, unknown>): string {
  const p = (input.projectId as string) ?? process.env.GCP_DEFAULT_PROJECT_ID;
  if (!p) {
    throw new Error(
      'No projectId provided and GCP_DEFAULT_PROJECT_ID is not set in .env. ' +
        'Either pass projectId in the tool call or set GCP_DEFAULT_PROJECT_ID.'
    );
  }
  return p;
}

function getRM(accountId?: string) {
  return google.cloudresourcemanager({ version: 'v3', auth: getAuthClient(accountId) });
}
function getIAM(accountId?: string) {
  return google.iam({ version: 'v1', auth: getAuthClient(accountId) });
}
function getServiceUsage(accountId?: string) {
  return google.serviceusage({ version: 'v1', auth: getAuthClient(accountId) });
}
function getCloudBuild(accountId?: string) {
  return google.cloudbuild({ version: 'v1', auth: getAuthClient(accountId) });
}
function getCloudRun(accountId?: string) {
  return google.run({ version: 'v2', auth: getAuthClient(accountId) });
}
function getStorage(accountId?: string) {
  return google.storage({ version: 'v1', auth: getAuthClient(accountId) });
}

const PROJECT_ID_PROP = {
  projectId: {
    type: 'string',
    description: 'GCP project ID. Defaults to GCP_DEFAULT_PROJECT_ID env var if not specified.',
  },
} as const;

export const GcpToolModule: ToolModule = {
  name: 'GoogleCloud',

  tools: [
    // ── Projects ────────────────────────────────────────────────────────────
    {
      name: 'gcp_list_projects',
      description: 'List all GCP projects accessible to the authenticated account.',
      input_schema: {
        type: 'object',
        properties: {
          pageSize: { type: 'number', description: 'Max results (default 20).' },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
    {
      name: 'gcp_create_project',
      description: 'Create a new GCP project.',
      input_schema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Unique project ID (lowercase, hyphens allowed).' },
          displayName: { type: 'string', description: 'Human-readable project name.' },
          parentId: {
            type: 'string',
            description: 'Parent folder or organisation resource name, e.g. "folders/12345" (optional).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: ['projectId', 'displayName'],
      },
    },

    // ── IAM ──────────────────────────────────────────────────────────────────
    {
      name: 'gcp_get_iam_policy',
      description: 'Get the IAM policy (roles and members) for a GCP project.',
      input_schema: {
        type: 'object',
        properties: { ...PROJECT_ID_PROP, ...ACCOUNT_ID_PROP },
        required: [],
      },
    },
    {
      name: 'gcp_add_iam_binding',
      description: 'Grant an IAM role to a member on a GCP project.',
      input_schema: {
        type: 'object',
        properties: {
          member: {
            type: 'string',
            description:
              'IAM member, e.g. "user:alice@example.com", "serviceAccount:sa@proj.iam.gserviceaccount.com", "group:devs@example.com".',
          },
          role: {
            type: 'string',
            description: 'IAM role, e.g. "roles/editor", "roles/storage.admin".',
          },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['member', 'role'],
      },
    },
    {
      name: 'gcp_remove_iam_binding',
      description: 'Remove an IAM role from a member on a GCP project.',
      input_schema: {
        type: 'object',
        properties: {
          member: { type: 'string', description: 'IAM member to remove.' },
          role: { type: 'string', description: 'IAM role to remove.' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['member', 'role'],
      },
    },

    // ── Service Accounts ──────────────────────────────────────────────────────
    {
      name: 'gcp_list_service_accounts',
      description: 'List service accounts in a GCP project.',
      input_schema: {
        type: 'object',
        properties: { ...PROJECT_ID_PROP, ...ACCOUNT_ID_PROP },
        required: [],
      },
    },
    {
      name: 'gcp_create_service_account',
      description: 'Create a new service account in a GCP project.',
      input_schema: {
        type: 'object',
        properties: {
          serviceAccountId: {
            type: 'string',
            description: 'Service account ID (lowercase, hyphens allowed). E.g. "my-app-sa".',
          },
          displayName: { type: 'string', description: 'Human-readable display name.' },
          description: { type: 'string', description: 'Description (optional).' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['serviceAccountId', 'displayName'],
      },
    },

    // ── API Management ────────────────────────────────────────────────────────
    {
      name: 'gcp_enable_api',
      description: 'Enable a Google Cloud API on a project.',
      input_schema: {
        type: 'object',
        properties: {
          apiName: {
            type: 'string',
            description: 'API service name, e.g. "gmail.googleapis.com", "run.googleapis.com", "cloudbuild.googleapis.com".',
          },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['apiName'],
      },
    },
    {
      name: 'gcp_list_enabled_apis',
      description: 'List all enabled APIs on a GCP project.',
      input_schema: {
        type: 'object',
        properties: {
          pageSize: { type: 'number', description: 'Max results (default 20).' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },

    // ── Cloud Build ───────────────────────────────────────────────────────────
    {
      name: 'gcp_list_builds',
      description: 'List recent Cloud Build builds for a project.',
      input_schema: {
        type: 'object',
        properties: {
          pageSize: { type: 'number', description: 'Max results (default 10).' },
          filter: { type: 'string', description: 'Build filter, e.g. "status=SUCCESS" (optional).' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
    {
      name: 'gcp_trigger_build',
      description: 'Trigger a Cloud Build from a source repository branch.',
      input_schema: {
        type: 'object',
        properties: {
          repoName: { type: 'string', description: 'Cloud Source Repository name or GitHub repo name.' },
          branchName: { type: 'string', description: 'Branch to build (e.g. "main").' },
          substitutions: {
            type: 'object',
            description: 'Build substitution variables as key-value pairs (optional).',
            additionalProperties: { type: 'string' },
          },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['repoName', 'branchName'],
      },
    },

    // ── Cloud Run ─────────────────────────────────────────────────────────────
    {
      name: 'gcp_list_run_services',
      description: 'List Cloud Run services in a region.',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'GCP region, e.g. "us-central1".' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['region'],
      },
    },
    {
      name: 'gcp_get_run_service',
      description: 'Get details about a specific Cloud Run service including its URL.',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'GCP region.' },
          serviceId: { type: 'string', description: 'Cloud Run service name.' },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['region', 'serviceId'],
      },
    },
    {
      name: 'gcp_deploy_run_service',
      description: 'Deploy or update a Cloud Run service with a new container image.',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'GCP region.' },
          serviceId: { type: 'string', description: 'Cloud Run service name (created if it does not exist).' },
          image: {
            type: 'string',
            description: 'Container image URL, e.g. "gcr.io/my-project/my-app:latest".',
          },
          envVars: {
            type: 'object',
            description: 'Environment variables to set on the container (optional).',
            additionalProperties: { type: 'string' },
          },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['region', 'serviceId', 'image'],
      },
    },

    // ── Cloud Storage ─────────────────────────────────────────────────────────
    {
      name: 'gcp_list_storage_buckets',
      description: 'List Cloud Storage buckets in a GCP project.',
      input_schema: {
        type: 'object',
        properties: { ...PROJECT_ID_PROP, ...ACCOUNT_ID_PROP },
        required: [],
      },
    },
    {
      name: 'gcp_create_storage_bucket',
      description: 'Create a new Cloud Storage bucket.',
      input_schema: {
        type: 'object',
        properties: {
          bucketName: { type: 'string', description: 'Globally unique bucket name.' },
          location: {
            type: 'string',
            description: 'Bucket location, e.g. "US", "us-central1" (default: "US").',
          },
          storageClass: {
            type: 'string',
            enum: ['STANDARD', 'NEARLINE', 'COLDLINE', 'ARCHIVE'],
            description: 'Storage class (default: STANDARD).',
          },
          ...PROJECT_ID_PROP,
          ...ACCOUNT_ID_PROP,
        },
        required: ['bucketName'],
      },
    },
  ],

  handlers: {
    // ── Projects ────────────────────────────────────────────────────────────
    async gcp_list_projects(input) {
      const rm = getRM(input.accountId as string | undefined);
      const res = await rm.projects.list({ pageSize: (input.pageSize as number) ?? 20 });
      const projects = res.data.projects ?? [];
      if (projects.length === 0) return 'No GCP projects found.';
      return projects
        .map((p) => `• ${p.projectId} — ${p.displayName ?? '(no name)'} [${p.state}]`)
        .join('\n');
    },

    async gcp_create_project(input) {
      const rm = getRM(input.accountId as string | undefined);
      const { projectId, displayName, parentId } = input as {
        projectId: string;
        displayName: string;
        parentId?: string;
      };
      const requestBody: any = { projectId, displayName };
      if (parentId) requestBody.parent = parentId;
      const op = await rm.projects.create({ requestBody });
      return `Project creation initiated: ${projectId} ("${displayName}"). Operation: ${op.data.name}`;
    },

    // ── IAM ──────────────────────────────────────────────────────────────────
    async gcp_get_iam_policy(input) {
      const rm = getRM(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const res = await rm.projects.getIamPolicy({
        resource: `projects/${projectId}`,
        requestBody: {},
      });
      const bindings = res.data.bindings ?? [];
      if (bindings.length === 0) return `No IAM bindings found for project "${projectId}".`;
      return bindings
        .map((b) => `Role: ${b.role}\n  Members: ${(b.members ?? []).join(', ')}`)
        .join('\n\n');
    },

    async gcp_add_iam_binding(input) {
      const rm = getRM(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { member, role } = input as { member: string; role: string };

      // Read-modify-write (GCP IAM requires this pattern)
      const existing = await rm.projects.getIamPolicy({
        resource: `projects/${projectId}`,
        requestBody: {},
      });
      const policy = existing.data;
      policy.bindings = policy.bindings ?? [];
      const binding = policy.bindings.find((b) => b.role === role);
      if (binding) {
        if (!binding.members?.includes(member)) binding.members?.push(member);
      } else {
        policy.bindings.push({ role, members: [member] });
      }
      await rm.projects.setIamPolicy({ resource: `projects/${projectId}`, requestBody: { policy } });
      return `Granted ${role} to ${member} on project "${projectId}".`;
    },

    async gcp_remove_iam_binding(input) {
      const rm = getRM(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { member, role } = input as { member: string; role: string };

      const existing = await rm.projects.getIamPolicy({
        resource: `projects/${projectId}`,
        requestBody: {},
      });
      const policy = existing.data;
      policy.bindings = (policy.bindings ?? [])
        .map((b) => {
          if (b.role === role) {
            return { ...b, members: (b.members ?? []).filter((m) => m !== member) };
          }
          return b;
        })
        .filter((b) => (b.members ?? []).length > 0);
      await rm.projects.setIamPolicy({ resource: `projects/${projectId}`, requestBody: { policy } });
      return `Removed ${role} from ${member} on project "${projectId}".`;
    },

    // ── Service Accounts ──────────────────────────────────────────────────────
    async gcp_list_service_accounts(input) {
      const iam = getIAM(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const res = await iam.projects.serviceAccounts.list({ name: `projects/${projectId}` });
      const accounts = res.data.accounts ?? [];
      if (accounts.length === 0) return `No service accounts found in project "${projectId}".`;
      return accounts
        .map((sa) => `• ${sa.email}\n  Name: ${sa.displayName ?? '(no name)'}\n  ID: ${sa.uniqueId}`)
        .join('\n\n');
    },

    async gcp_create_service_account(input) {
      const iam = getIAM(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { serviceAccountId, displayName, description } = input as {
        serviceAccountId: string;
        displayName: string;
        description?: string;
      };
      const res = await iam.projects.serviceAccounts.create({
        name: `projects/${projectId}`,
        requestBody: {
          accountId: serviceAccountId,
          serviceAccount: { displayName, description },
        },
      });
      return `Service account created: ${res.data.email} (project: ${projectId})`;
    },

    // ── API Management ────────────────────────────────────────────────────────
    async gcp_enable_api(input) {
      const su = getServiceUsage(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const apiName = input.apiName as string;
      const op = await su.services.enable({
        name: `projects/${projectId}/services/${apiName}`,
        requestBody: {},
      });
      return `Enabling ${apiName} on project "${projectId}". Operation: ${op.data.name}`;
    },

    async gcp_list_enabled_apis(input) {
      const su = getServiceUsage(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const res = await su.services.list({
        parent: `projects/${projectId}`,
        filter: 'state:ENABLED',
        pageSize: (input.pageSize as number) ?? 20,
      });
      const services = res.data.services ?? [];
      if (services.length === 0) return `No enabled APIs found for project "${projectId}".`;
      return services.map((s) => `• ${s.name?.split('/').pop()}`).join('\n');
    },

    // ── Cloud Build ───────────────────────────────────────────────────────────
    async gcp_list_builds(input) {
      const cb = getCloudBuild(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const res = await cb.projects.builds.list({
        projectId,
        pageSize: (input.pageSize as number) ?? 10,
        filter: (input.filter as string) ?? undefined,
      });
      const builds = res.data.builds ?? [];
      if (builds.length === 0) return `No builds found for project "${projectId}".`;
      return builds
        .map(
          (b) =>
            `• ${b.id}\n  Status: ${b.status}\n  Branch: ${b.substitutions?.BRANCH_NAME ?? 'N/A'}\n  Created: ${b.createTime}\n  Duration: ${b.timing?.BUILD?.endTime ? 'done' : 'running'}`
        )
        .join('\n\n');
    },

    async gcp_trigger_build(input) {
      const cb = getCloudBuild(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { repoName, branchName, substitutions } = input as {
        repoName: string;
        branchName: string;
        substitutions?: Record<string, string>;
      };
      const res = await cb.projects.builds.create({
        projectId,
        requestBody: {
          source: {
            repoSource: { projectId, repoName, branchName },
          },
          substitutions,
        },
      });
      return `Build triggered for ${repoName}@${branchName} (project: ${projectId}). Build ID: ${res.data.metadata?.build?.id ?? 'pending'}`;
    },

    // ── Cloud Run ─────────────────────────────────────────────────────────────
    async gcp_list_run_services(input) {
      const run = getCloudRun(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const region = input.region as string;
      const res = await run.projects.locations.services.list({
        parent: `projects/${projectId}/locations/${region}`,
      });
      const services = res.data.services ?? [];
      if (services.length === 0) return `No Cloud Run services found in ${region}.`;
      return services
        .map(
          (s) =>
            `• ${s.name?.split('/').pop()}\n  URL: ${s.uri ?? 'N/A'}\n  Traffic: ${s.traffic?.map((t) => `${t.percent}% → ${t.revision ?? 'latest'}`).join(', ') ?? 'N/A'}`
        )
        .join('\n\n');
    },

    async gcp_get_run_service(input) {
      const run = getCloudRun(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { region, serviceId } = input as { region: string; serviceId: string };
      const res = await run.projects.locations.services.get({
        name: `projects/${projectId}/locations/${region}/services/${serviceId}`,
      });
      const s = res.data;
      const containers = s.template?.containers ?? [];
      return [
        `Service: ${serviceId}`,
        `URL: ${s.uri ?? 'N/A'}`,
        `Region: ${region}`,
        `Image: ${containers[0]?.image ?? 'N/A'}`,
        `Replicas: ${s.template?.scaling?.minInstanceCount ?? 0}–${s.template?.scaling?.maxInstanceCount ?? 'auto'}`,
        `Ingress: ${s.ingress ?? 'N/A'}`,
      ].join('\n');
    },

    async gcp_deploy_run_service(input) {
      const run = getCloudRun(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { region, serviceId, image, envVars } = input as {
        region: string;
        serviceId: string;
        image: string;
        envVars?: Record<string, string>;
      };

      const env = envVars
        ? Object.entries(envVars).map(([name, value]) => ({ name, value }))
        : undefined;

      const res = await run.projects.locations.services.patch({
        name: `projects/${projectId}/locations/${region}/services/${serviceId}`,
        updateMask: 'template.containers',
        requestBody: {
          template: {
            containers: [{ image, env }],
          },
        },
      });
      return `Deploying ${serviceId} with image "${image}" in ${region}. Operation: ${res.data.name}`;
    },

    // ── Cloud Storage ─────────────────────────────────────────────────────────
    async gcp_list_storage_buckets(input) {
      const storage = getStorage(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const res = await storage.buckets.list({ project: projectId });
      const buckets = res.data.items ?? [];
      if (buckets.length === 0) return `No GCS buckets found in project "${projectId}".`;
      return buckets
        .map((b) => `• ${b.name}\n  Location: ${b.location}\n  Class: ${b.storageClass}`)
        .join('\n\n');
    },

    async gcp_create_storage_bucket(input) {
      const storage = getStorage(input.accountId as string | undefined);
      const projectId = resolveProject(input);
      const { bucketName, location, storageClass } = input as {
        bucketName: string;
        location?: string;
        storageClass?: string;
      };
      await storage.buckets.insert({
        project: projectId,
        requestBody: {
          name: bucketName,
          location: location ?? 'US',
          storageClass: storageClass ?? 'STANDARD',
        },
      });
      return `Bucket "gs://${bucketName}" created in ${location ?? 'US'} with ${storageClass ?? 'STANDARD'} storage class.`;
    },
  },
};
