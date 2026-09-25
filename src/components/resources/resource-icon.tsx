import { Box, CirclePlay, CodeXml, FileSpreadsheet, FileText, Globe, Link, type LucideIcon } from "lucide-react";
import type { ResourceType } from "@/generated/prisma/enums";

const ICONS: Record<ResourceType, LucideIcon> = {
  DOCUMENT: FileText,
  SPREADSHEET: FileSpreadsheet,
  WEBSITE: Globe,
  CAD: Box,
  CODE: CodeXml,
  VIDEO: CirclePlay,
  OTHER: Link,
};

export function ResourceIcon({ type, className = "size-5" }: { type: ResourceType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} aria-hidden />;
}
