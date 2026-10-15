// kindLabel names a backup's reason in words a person reads rather than the
// server's code.
//
// It lives beside the api client instead of in a component so the Backups list
// and the backup viewer label an entry the same way without either importing
// the other; a components file that also exports a helper breaks fast refresh.
export function kindLabel(kind: string): string {
  switch (kind) {
    case "daily":
      return "Daily";
    case "manual":
      return "Manual";
    case "pre_restore":
      return "Before restore";
    case "initial":
      return "Initial";
    default:
      return kind;
  }
}
