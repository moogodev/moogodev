// media.ts is the dashboard's copy of the server's content-type classifier.
//
// It exists so a file can be named as wrong before it is sent, not so the policy
// is enforced here. The server re-runs the same classification and has the last
// word; a mismatch costs one wasted round trip, while no check here costs the
// user a rejected upload with a status code and no explanation.
//
// Keep mediaClass in step with mediaClass in internal/handler/bucket.go. The lists
// below are the same MIME types in the same order.

import type { BucketAllowedTypes } from "./api";

// MEDIA_CLASSES are the checkboxes on the bucket settings page, in the order they
// are shown. "any" comes first because it is the setting a bucket starts on, and
// "file" comes last because it is the class that needs the most explaining.
export const MEDIA_CLASSES: {
  id: BucketAllowedTypes;
  label: string;
  hint: string;
}[] = [
  {
    id: "any",
    label: "Any file",
    hint: "No restriction. This is the default for a new bucket.",
  },
  {
    id: "image",
    label: "Images",
    hint: "PNG, JPEG, GIF, WebP, SVG, and anything else sent as image/*.",
  },
  {
    id: "video",
    label: "Videos",
    hint: "MP4, WebM, QuickTime, and anything else sent as video/*.",
  },
  {
    id: "audio",
    label: "Audio",
    hint: "MP3, WAV, Ogg, FLAC, and anything else sent as audio/*.",
  },
  {
    id: "document",
    label: "Documents",
    hint: "PDF, Word, Excel, PowerPoint, OpenDocument, plain text.",
  },
  {
    id: "archive",
    label: "Archives",
    hint: "Zip, Gzip, Tar, 7z, Rar, Bzip2, Xz.",
  },
  {
    id: "file",
    label: "Other files",
    hint: "Everything the categories above do not cover: binaries, fonts, and the like.",
  },
];

// documentTypes are the content types that are documents rather than media.
//
// Listed rather than derived from a prefix because they share none: text/* is a
// prefix and the office formats are not.
const documentTypes = new Set([
  "application/pdf",
  "application/rtf",
  "application/epub+zip",
  "text/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
]);

// archiveTypes are the content types of compressed bundles.
//
// Zip is here rather than left to the catch-all because zip is what an office
// document actually arrives as, and a .docx would otherwise be refused by a
// bucket set to documents.
const archiveTypes = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/x-bzip2",
  "application/x-xz",
]);

// mediaClass sorts a content type into the classes a bucket policy names.
//
// "file" is the catch-all for whatever is none of the others, which is what makes
// it a real choice rather than a synonym for "any": a bucket set to Other files
// refuses a .png and accepts a compiled binary.
export function mediaClass(contentType: string): BucketAllowedTypes {
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("audio/")) return "audio";
  if (documentTypes.has(mediaType) || mediaType.startsWith("text/")) return "document";
  if (archiveTypes.has(mediaType)) return "archive";
  return "file";
}

// policyAllows mirrors the server's bucketAcceptsContentType.
export function policyAllows(
  allowed: readonly BucketAllowedTypes[],
  contentType: string,
): boolean {
  // An empty policy means no restriction, which is how a bucket created before
  // the policy existed reads. "any" says the same thing out loud.
  if (allowed.length === 0 || allowed.includes("any")) {
    return true;
  }
  return allowed.includes(mediaClass(contentType));
}

// acceptFor is the accept attribute matching a bucket's policy.
//
// The attribute lists what is permitted and has no way to exclude, so "Other
// files" cannot be expressed as a MIME list -- there is no pattern for "not an
// image". Rather than offer the whole filesystem and let the server refuse it,
// the picker falls back to no attribute, which is honest about what the browser
// can express. The pre-upload check below is what actually catches it.
export function acceptFor(allowed: readonly BucketAllowedTypes[]): string | undefined {
  if (allowed.length === 0 || allowed.includes("any") || allowed.includes("file")) {
    return undefined;
  }
  const patterns: string[] = [];
  if (allowed.includes("image")) patterns.push("image/*");
  if (allowed.includes("video")) patterns.push("video/*");
  if (allowed.includes("audio")) patterns.push("audio/*");
  if (allowed.includes("document")) {
    patterns.push("text/*", "application/pdf", "application/msword", "application/rtf");
  }
  if (allowed.includes("archive")) {
    patterns.push("application/zip", "application/gzip", "application/x-tar");
  }
  return patterns.length > 0 ? patterns.join(",") : undefined;
}

// describePolicy renders a bucket's policy for a sentence about one file.
//
// "Any file" and "Other files" are named rather than echoed, because neither is a
// class a user would recognise from their own upload.
export function describePolicy(allowed: readonly BucketAllowedTypes[]): string {
  if (allowed.length === 0 || allowed.includes("any")) {
    return "any file";
  }
  return allowed.map((entry) => labelFor(entry)).join(", ");
}

// labelFor is the checkbox label for a class, used when a policy is read back
// as a sentence.
function labelFor(entry: BucketAllowedTypes): string {
  return MEDIA_CLASSES.find((option) => option.id === entry)?.label ?? entry;
}
