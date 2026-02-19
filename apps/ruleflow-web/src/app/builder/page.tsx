import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function buildRedirectUrl(searchParams: SearchParams) {
  const entries = Object.entries(searchParams ?? {});
  if (entries.length === 0) return "/builder/screens";
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const qs = query.toString();
  return qs ? `/builder/screens?${qs}` : "/builder/screens";
}

export default async function BuilderIndex({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  redirect(buildRedirectUrl(searchParams ?? {}));
}
