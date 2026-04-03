import { google } from 'googleapis';
import { ToolModule } from '../base.js';
import { getAuthClient } from './auth.js';

/**
 * Google Workspace Admin SDK Tool Module.
 *
 * Requirements:
 *  - The authenticated Google account must be a Super Admin or delegated admin
 *    in the Google Workspace organization.
 *  - Set GOOGLE_ADMIN_CUSTOMER_ID in .env (from admin.google.com → Account → Settings)
 *    or leave unset to use the built-in "my_customer" alias.
 *  - Set GOOGLE_ADMIN_DOMAIN in .env for display purposes.
 */

const ACCOUNT_ID_PROP = {
  accountId: {
    type: 'string',
    description: 'Google admin account to use (e.g. "work"). Defaults to primary account.',
  },
} as const;

function resolveCustomer(): string {
  return process.env.GOOGLE_ADMIN_CUSTOMER_ID ?? 'my_customer';
}

function getDirectory(accountId?: string) {
  return google.admin({ version: 'directory_v1', auth: getAuthClient(accountId) });
}

function getReports(accountId?: string) {
  return google.admin({ version: 'reports_v1', auth: getAuthClient(accountId) });
}

export const AdminToolModule: ToolModule = {
  name: 'GoogleAdmin',

  tools: [
    // ── Users ──────────────────────────────────────────────────────────────
    {
      name: 'admin_list_users',
      description: 'List users in the Google Workspace directory.',
      input_schema: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: 'Max users to return (default 10, max 50).' },
          query: {
            type: 'string',
            description: 'Search query, e.g. "name:Alice", "email:alice@example.com".',
          },
          orderBy: {
            type: 'string',
            enum: ['email', 'familyName', 'givenName'],
            description: 'Sort field (default: email).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
    {
      name: 'admin_get_user',
      description: 'Get detailed information about a specific Workspace user.',
      input_schema: {
        type: 'object',
        properties: {
          userKey: {
            type: 'string',
            description: 'User email address or unique user ID.',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: ['userKey'],
      },
    },
    {
      name: 'admin_create_user',
      description: 'Create a new Google Workspace user.',
      input_schema: {
        type: 'object',
        properties: {
          primaryEmail: { type: 'string', description: 'New user\'s email address.' },
          firstName: { type: 'string', description: 'Given (first) name.' },
          lastName: { type: 'string', description: 'Family (last) name.' },
          password: { type: 'string', description: 'Initial password (min 8 chars).' },
          changePasswordAtNextLogin: {
            type: 'boolean',
            description: 'Force password reset on first login (default: true).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: ['primaryEmail', 'firstName', 'lastName', 'password'],
      },
    },
    {
      name: 'admin_update_user',
      description: 'Update a Workspace user\'s name, password, or other fields.',
      input_schema: {
        type: 'object',
        properties: {
          userKey: { type: 'string', description: 'User email address or unique user ID.' },
          firstName: { type: 'string', description: 'New given name (optional).' },
          lastName: { type: 'string', description: 'New family name (optional).' },
          password: { type: 'string', description: 'New password (optional).' },
          changePasswordAtNextLogin: {
            type: 'boolean',
            description: 'Force password reset on next login (optional).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: ['userKey'],
      },
    },
    {
      name: 'admin_suspend_user',
      description: 'Suspend a Google Workspace user account (blocks sign-in).',
      input_schema: {
        type: 'object',
        properties: {
          userKey: { type: 'string', description: 'User email address or unique user ID.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['userKey'],
      },
    },
    {
      name: 'admin_unsuspend_user',
      description: 'Restore (un-suspend) a previously suspended Google Workspace user.',
      input_schema: {
        type: 'object',
        properties: {
          userKey: { type: 'string', description: 'User email address or unique user ID.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['userKey'],
      },
    },

    // ── Groups ─────────────────────────────────────────────────────────────
    {
      name: 'admin_list_groups',
      description: 'List Google Workspace groups in the organisation.',
      input_schema: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: 'Max groups to return (default 10).' },
          query: { type: 'string', description: 'Search query, e.g. "name:Engineering".' },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
    {
      name: 'admin_create_group',
      description: 'Create a new Google Workspace group.',
      input_schema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Group email address.' },
          name: { type: 'string', description: 'Group display name.' },
          description: { type: 'string', description: 'Group description (optional).' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['email', 'name'],
      },
    },
    {
      name: 'admin_add_group_member',
      description: 'Add a user to a Google Workspace group.',
      input_schema: {
        type: 'object',
        properties: {
          groupKey: { type: 'string', description: 'Group email address or unique group ID.' },
          memberEmail: { type: 'string', description: 'Email of user to add.' },
          role: {
            type: 'string',
            enum: ['MEMBER', 'MANAGER', 'OWNER'],
            description: 'Member role (default: MEMBER).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: ['groupKey', 'memberEmail'],
      },
    },
    {
      name: 'admin_remove_group_member',
      description: 'Remove a user from a Google Workspace group.',
      input_schema: {
        type: 'object',
        properties: {
          groupKey: { type: 'string', description: 'Group email address or unique group ID.' },
          memberEmail: { type: 'string', description: 'Email of member to remove.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['groupKey', 'memberEmail'],
      },
    },
    {
      name: 'admin_list_group_members',
      description: 'List all members of a Google Workspace group.',
      input_schema: {
        type: 'object',
        properties: {
          groupKey: { type: 'string', description: 'Group email address or unique group ID.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['groupKey'],
      },
    },

    // ── Org Units ──────────────────────────────────────────────────────────
    {
      name: 'admin_list_org_units',
      description: 'List organisational units (OUs) in the Google Workspace domain.',
      input_schema: {
        type: 'object',
        properties: {
          orgUnitPath: {
            type: 'string',
            description: 'Parent OU path to list children of (default: "/" for root).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },

    // ── Audit ──────────────────────────────────────────────────────────────
    {
      name: 'admin_get_audit_log',
      description: 'Get recent admin activity audit log entries (last 7 days by default).',
      input_schema: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: 'Max entries to return (default 10).' },
          eventName: {
            type: 'string',
            description: 'Filter by event name, e.g. "CREATE_USER", "DELETE_USER", "GRANT_ADMIN_PRIVILEGE" (optional).',
          },
          actorEmail: {
            type: 'string',
            description: 'Filter by admin who performed the action (optional).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
  ],

  handlers: {
    // ── Users ────────────────────────────────────────────────────────────
    async admin_list_users(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const res = await dir.users.list({
        customer: resolveCustomer(),
        maxResults: Math.min((input.maxResults as number) ?? 10, 50),
        query: (input.query as string) ?? undefined,
        orderBy: (input.orderBy as string) ?? 'email',
        projection: 'basic',
      });
      const users = res.data.users ?? [];
      if (users.length === 0) return 'No users found matching that query.';
      return users
        .map(
          (u) =>
            `• ${u.primaryEmail}\n  Name: ${u.name?.fullName ?? 'N/A'}\n  Status: ${u.suspended ? 'Suspended' : 'Active'}`
        )
        .join('\n\n');
    },

    async admin_get_user(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const res = await dir.users.get({ userKey: input.userKey as string, projection: 'basic' });
      const u = res.data;
      return [
        `Email: ${u.primaryEmail}`,
        `Name: ${u.name?.fullName}`,
        `Status: ${u.suspended ? 'Suspended' : 'Active'}`,
        `Admin: ${u.isAdmin ? 'Yes' : 'No'}`,
        `Created: ${u.creationTime}`,
        `Last login: ${u.lastLoginTime ?? 'Never'}`,
        `Org unit: ${u.orgUnitPath}`,
      ].join('\n');
    },

    async admin_create_user(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const { primaryEmail, firstName, lastName, password, changePasswordAtNextLogin } =
        input as {
          primaryEmail: string;
          firstName: string;
          lastName: string;
          password: string;
          changePasswordAtNextLogin?: boolean;
        };
      const res = await dir.users.insert({
        requestBody: {
          primaryEmail,
          name: { givenName: firstName, familyName: lastName },
          password,
          changePasswordAtNextLogin: changePasswordAtNextLogin ?? true,
        },
      });
      return `User created: ${res.data.primaryEmail} (${res.data.name?.fullName})`;
    },

    async admin_update_user(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const { userKey, firstName, lastName, password, changePasswordAtNextLogin } = input as {
        userKey: string;
        firstName?: string;
        lastName?: string;
        password?: string;
        changePasswordAtNextLogin?: boolean;
      };
      const requestBody: any = {};
      if (firstName || lastName) {
        requestBody.name = {};
        if (firstName) requestBody.name.givenName = firstName;
        if (lastName) requestBody.name.familyName = lastName;
      }
      if (password) requestBody.password = password;
      if (changePasswordAtNextLogin !== undefined) {
        requestBody.changePasswordAtNextLogin = changePasswordAtNextLogin;
      }
      const res = await dir.users.patch({ userKey, requestBody });
      return `User updated: ${res.data.primaryEmail}`;
    },

    async admin_suspend_user(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const userKey = input.userKey as string;
      await dir.users.patch({ userKey, requestBody: { suspended: true } });
      return `User "${userKey}" has been suspended.`;
    },

    async admin_unsuspend_user(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const userKey = input.userKey as string;
      await dir.users.patch({ userKey, requestBody: { suspended: false } });
      return `User "${userKey}" has been unsuspended and can now sign in.`;
    },

    // ── Groups ──────────────────────────────────────────────────────────
    async admin_list_groups(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const res = await dir.groups.list({
        customer: resolveCustomer(),
        maxResults: (input.maxResults as number) ?? 10,
        query: (input.query as string) ?? undefined,
      });
      const groups = res.data.groups ?? [];
      if (groups.length === 0) return 'No groups found.';
      return groups
        .map(
          (g) =>
            `• ${g.email}\n  Name: ${g.name}\n  Members: ${g.directMembersCount ?? '?'}`
        )
        .join('\n\n');
    },

    async admin_create_group(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const { email, name, description } = input as {
        email: string;
        name: string;
        description?: string;
      };
      const res = await dir.groups.insert({ requestBody: { email, name, description } });
      return `Group created: ${res.data.email} ("${res.data.name}")`;
    },

    async admin_add_group_member(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const { groupKey, memberEmail, role } = input as {
        groupKey: string;
        memberEmail: string;
        role?: string;
      };
      await dir.members.insert({
        groupKey,
        requestBody: { email: memberEmail, role: role ?? 'MEMBER' },
      });
      return `Added ${memberEmail} to group "${groupKey}" as ${role ?? 'MEMBER'}.`;
    },

    async admin_remove_group_member(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const { groupKey, memberEmail } = input as { groupKey: string; memberEmail: string };
      await dir.members.delete({ groupKey, memberKey: memberEmail });
      return `Removed ${memberEmail} from group "${groupKey}".`;
    },

    async admin_list_group_members(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const res = await dir.members.list({ groupKey: input.groupKey as string });
      const members = res.data.members ?? [];
      if (members.length === 0) return `No members found in group "${input.groupKey}".`;
      return members
        .map((m) => `• ${m.email} (${m.role ?? 'MEMBER'}, status: ${m.status ?? 'ACTIVE'})`)
        .join('\n');
    },

    // ── Org Units ──────────────────────────────────────────────────────
    async admin_list_org_units(input) {
      const dir = getDirectory(input.accountId as string | undefined);
      const res = await dir.orgunits.list({
        customerId: resolveCustomer(),
        orgUnitPath: (input.orgUnitPath as string) ?? '/',
        type: 'children',
      });
      const units = res.data.organizationUnits ?? [];
      if (units.length === 0) return 'No organisational units found.';
      return units
        .map((u) => `• ${u.orgUnitPath}\n  Name: ${u.name}\n  ${u.description ?? ''}`)
        .join('\n\n');
    },

    // ── Audit ──────────────────────────────────────────────────────────
    async admin_get_audit_log(input) {
      const reports = getReports(input.accountId as string | undefined);
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await reports.activities.list({
        userKey: 'all',
        applicationName: 'admin',
        maxResults: (input.maxResults as number) ?? 10,
        eventName: (input.eventName as string) ?? undefined,
        actorIpAddress: undefined,
        startTime,
      });
      const activities = res.data.items ?? [];
      if (activities.length === 0) return 'No admin audit events found in the last 7 days.';
      return activities
        .map((a) => {
          const actor = a.actor?.email ?? 'unknown';
          const events = (a.events ?? [])
            .map((e) => {
              const params = (e.parameters ?? [])
                .map((p) => `${p.name}=${p.value ?? p.intValue ?? p.boolValue}`)
                .join(', ');
              return `  ${e.name}${params ? ` (${params})` : ''}`;
            })
            .join('\n');
          return `• ${a.id?.time} — ${actor}\n${events}`;
        })
        .join('\n\n');
    },
  },
};
