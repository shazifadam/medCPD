import "server-only";
import { sql } from "@/lib/db";

/** Options for the OrgCombobox, alphabetical. */
export async function listOrganizations(): Promise<
  { id: string; name: string }[]
> {
  return sql<{ id: string; name: string }[]>`
    select id, name from institutions where is_active order by name asc
  `;
}

/**
 * Resolve an OrgCombobox submission (`id:<uuid>` | `new:<name>`) to an
 * institution id. Inline-created orgs get type 'other' and can be
 * completed later in OG; a case-insensitive name match reuses the
 * existing row instead of duplicating it.
 */
export async function resolveOrganization(
  raw: string,
  createdBy: string
): Promise<string | null> {
  const value = raw.trim();
  if (value.startsWith("id:")) {
    const id = value.slice(3);
    const rows = await sql<{ id: string }[]>`
      select id from institutions where id = ${id}
    `;
    return rows[0]?.id ?? null;
  }
  if (value.startsWith("new:")) {
    const name = value.slice(4).trim();
    if (name.length < 2) return null;
    const existing = await sql<{ id: string }[]>`
      select id from institutions where lower(name) = lower(${name}) limit 1
    `;
    if (existing.length > 0) return existing[0].id;
    const [row] = await sql<{ id: string }[]>`
      insert into institutions (name, type, created_by)
      values (${name}, 'other', ${createdBy})
      returning id
    `;
    return row.id;
  }
  return null;
}
