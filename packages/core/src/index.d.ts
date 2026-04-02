/**
 * @upbrew/tangentflow - Type definitions
 *
 * PDF document generation with pixel-perfect text wrapping.
 * Powered by Pretext.
 */

// ─── Color types ──────────────────────────────────────────

/** RGB color as a 3-element array with values between 0 and 1. */
export type RgbColor = [number, number, number];

/** A color value can be specified as a hex string (e.g. "#ff0000") or an RGB array. */
export type ColorValue = string | RgbColor;

// ─── Page configuration ───────────────────────────────────

export type PageSizeName = 'a4' | 'letter' | 'legal';

export type Orientation = 'portrait' | 'landscape';

export interface PageSize {
  w: number;
  h: number;
}

export interface PageConfig {
  /** Page size preset. Defaults to 'a4'. */
  size?: PageSizeName;
  /** Page orientation. Defaults to 'portrait'. */
  orientation?: Orientation;
  /** Margin in points. Defaults to 60. */
  margin?: number;
}

// ─── Color configuration ──────────────────────────────────

export interface ColorConfig {
  heading?: ColorValue;
  body?: ColorValue;
  accent?: ColorValue;
  tableHeader?: ColorValue;
  tableStripe?: ColorValue;
  divider?: ColorValue;
  quoteBar?: ColorValue;
  statBg?: ColorValue;
  muted?: ColorValue;
}

/** Resolved color config where all values are RGB arrays. */
export interface ResolvedColorConfig {
  heading: RgbColor;
  body: RgbColor;
  accent: RgbColor;
  tableHeader: RgbColor;
  tableStripe: RgbColor;
  divider: RgbColor;
  quoteBar: RgbColor;
  statBg: RgbColor;
  muted: RgbColor;
}

// ─── Header / Footer ─────────────────────────────────────

export interface HeaderFooterConfig {
  /** Text shown on the left side of the header. */
  headerLeft?: string;
  /** Text shown on the right side of the header. */
  headerRight?: string;
  /** Logo image source (data URL or path). */
  logoSrc?: string;
  /** Pre-loaded logo image object (platform-specific). */
  _logoImg?: unknown;
  /** Natural width of the logo image. */
  _logoW?: number;
  /** Natural height of the logo image. */
  _logoH?: number;
  /** Text shown on the left side of the footer. */
  footerLeft?: string;
  /** Footer right mode: 'none', 'page-number', or 'custom'. */
  footerRightMode?: 'none' | 'page-number' | 'custom';
  /** Custom text for the footer right when footerRightMode is 'custom'. */
  footerCustom?: string;
}

// ─── Watermark ────────────────────────────────────────────

export interface WatermarkConfig {
  text?: string;
  color?: ColorValue;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
  [key: string]: unknown;
}

// ─── Metadata ─────────────────────────────────────────────

export interface MetadataConfig {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  [key: string]: unknown;
}

// ─── Document options ─────────────────────────────────────

export interface DocumentOptions {
  page?: PageConfig;
  colors?: ColorConfig;
  headerFooter?: HeaderFooterConfig | null;
  watermark?: WatermarkConfig | null;
  metadata?: MetadataConfig;
}

// ─── Block types (discriminated union) ────────────────────

export interface HeadingBlock {
  type: 'heading';
  text: string;
  level: 1 | 2 | 3;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletListBlock {
  type: 'bullet-list';
  /** Newline-separated list items (internal format). */
  items: string;
}

export interface NumberedListBlock {
  type: 'numbered-list';
  /** Newline-separated list items (internal format). */
  items: string;
}

export interface QuoteBlock {
  type: 'quote';
  text: string;
  attribution?: string;
}

export interface TableBorders {
  /** Draw outer border. Defaults to true. */
  outer?: boolean;
  /** Draw header separator. Defaults to true. */
  header?: boolean;
  /** Draw row separators. Defaults to true. */
  rows?: boolean;
  /** Draw column separators. Defaults to true. */
  columns?: boolean;
  /** Border line width in points. Defaults to 0.5. */
  width?: number;
  /** Border color as hex string or RGB array. */
  color?: ColorValue | null;
}

export interface TableOptions {
  /** Column header labels. */
  headers: string[];
  /** Array of rows, each row is an array of cell strings. */
  rows: string[][];
  /** Column widths: a number for fixed points, or 'auto' for proportional. */
  colWidths?: (number | 'auto')[];
  /** Per-column text alignment. */
  align?: ('left' | 'center' | 'right')[];
  /** Table border configuration. */
  borders?: TableBorders;
}

export interface TableBlock {
  type: 'table';
  /** Comma-separated header labels (internal format). */
  headers: string;
  /** Newline-separated, comma-separated rows (internal format). */
  rows: string;
  colWidths?: (number | 'auto')[];
  align?: ('left' | 'center' | 'right')[];
  borders?: TableBorders;
}

export interface KeyValueBlock {
  type: 'key-value';
  /** Newline-separated "key: value" pairs (internal format). */
  items: string;
}

export interface TwoColumnBlock {
  type: 'two-column';
  left: string;
  right: string;
}

export interface StatItem {
  label: string;
  value: string;
}

export interface StatRowBlock {
  type: 'stat-row';
  /** Array of { label, value } objects, or a legacy comma-separated string. */
  items: StatItem[] | string;
}

export interface ImageBlock {
  type: 'image';
  /** Image source (data URL or path). */
  src: string;
  /** Display width in points. Defaults to 200. */
  width?: number;
  /** Horizontal alignment. Defaults to 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Text wrap mode. Defaults to 'none'. */
  wrap?: 'none' | 'left' | 'right';
  /** Pre-loaded image object (platform-specific). */
  _img?: unknown;
  /** Natural image width in pixels. */
  _naturalW?: number;
  /** Natural image height in pixels. */
  _naturalH?: number;
}

export interface SpacerBlock {
  type: 'spacer';
  /** Height in points. Defaults to 20. */
  height: number;
}

export interface DividerBlock {
  type: 'divider';
}

export interface PageBreakBlock {
  type: 'page-break';
}

/** Discriminated union of all block types. */
export type Block =
  | HeadingBlock
  | ParagraphBlock
  | BulletListBlock
  | NumberedListBlock
  | QuoteBlock
  | TableBlock
  | KeyValueBlock
  | TwoColumnBlock
  | StatRowBlock
  | ImageBlock
  | SpacerBlock
  | DividerBlock
  | PageBreakBlock;

// ─── Draw commands ────────────────────────────────────────

export interface TextDrawCommand {
  type: 'text';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontKey: string;
  color: RgbColor;
  align?: 'left' | 'center' | 'right';
}

export interface RectDrawCommand {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  color: RgbColor;
  radius?: number;
}

export interface LineDrawCommand {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: RgbColor;
  lineWidth?: number;
}

export interface ImageDrawCommand {
  type: 'image';
  img: unknown;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LinkDrawCommand {
  type: 'link';
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
}

export interface InternalLinkDrawCommand {
  type: 'internal-link';
  x: number;
  y: number;
  w: number;
  h: number;
  target: string;
}

/** Discriminated union of all draw command types. */
export type DrawCommand =
  | TextDrawCommand
  | RectDrawCommand
  | LineDrawCommand
  | ImageDrawCommand
  | LinkDrawCommand
  | InternalLinkDrawCommand;

// ─── Build result ─────────────────────────────────────────

export interface BuildResult {
  /** Array of pages, each page is an array of draw commands. */
  pages: DrawCommand[][];
  /** Resolved page dimensions in points. */
  pageSize: PageSize;
  /** Watermark configuration, or null if none. */
  watermark: WatermarkConfig | null;
  /** Document metadata. */
  metadata: MetadataConfig;
  /** Document outline / table of contents. */
  outline?: OutlineEntry[];
}

export interface OutlineEntry {
  title: string;
  level: number;
  page: number;
  y: number;
}

// ─── Flow engine ──────────────────────────────────────────

export interface FlowEngineMetrics {
  pageCount: number;
  contentW: number;
  contentH: number;
}

export interface FlowEngine {
  addText(
    text: string,
    fontSize: number,
    fontKey: string,
    options?: {
      bold?: boolean;
      color?: RgbColor;
      lineHeightMult?: number;
      indent?: number;
    }
  ): void;
  addImage(block: ImageBlock): void;
  addTable(
    headers: string[],
    rows: string[],
    options?: {
      colWidths?: (number | 'auto')[];
      align?: ('left' | 'center' | 'right')[];
      borders?: TableBorders;
    }
  ): void;
  addDivider(): void;
  addSpacer(height: number): void;
  addStatRow(items: StatItem[]): void;
  addList(items: string[], ordered: boolean): void;
  addQuote(text: string, attribution: string): void;
  addKeyValue(items: string[]): void;
  addTwoColumn(leftText: string, rightText: string): void;
  addPageBreak(): void;
  clearFloat(): void;
  addPageNumbers(): void;
  addHeadersFooters(): void;
  /** The array of pages, each containing draw commands. */
  pages: DrawCommand[][];
  getMetrics(): FlowEngineMetrics;
}

// ─── Document builder ─────────────────────────────────────

export interface DocumentBuilder {
  /** Add an image block. */
  image(src: string, opts?: {
    width?: number;
    align?: 'left' | 'center' | 'right';
    wrap?: 'none' | 'left' | 'right';
    _img?: unknown;
    _naturalW?: number;
    _naturalH?: number;
  }): DocumentBuilder;

  /** Add a heading. */
  heading(text: string, opts?: { level?: 1 | 2 | 3 }): DocumentBuilder;

  /** Add a paragraph. Supports **bold**, *italic*, __underline__, [link](url). */
  paragraph(text: string): DocumentBuilder;

  /** Add a bullet list. */
  bulletList(items: string[]): DocumentBuilder;

  /** Add a numbered list. */
  numberedList(items: string[]): DocumentBuilder;

  /** Add a quote/callout block. */
  quote(text: string, attribution?: string): DocumentBuilder;

  /** Add a table with auto-sized columns and per-cell wrapping. */
  table(opts: TableOptions): DocumentBuilder;

  /** Add key-value pairs. */
  keyValue(data: Record<string, string | number>): DocumentBuilder;

  /** Add a two-column layout. */
  twoColumn(left: string, right: string): DocumentBuilder;

  /** Add stat cards. */
  statRow(data: Record<string, string | number>): DocumentBuilder;

  /** Add a horizontal divider. */
  divider(): DocumentBuilder;

  /** Add vertical spacing. */
  spacer(height?: number): DocumentBuilder;

  /** Force a page break. */
  pageBreak(): DocumentBuilder;

  /** Add a raw block object (for advanced use or custom block types). */
  addBlock(block: Block | Record<string, unknown>): DocumentBuilder;

  /** Get the blocks array (for serialization/inspection). */
  getBlocks(): Block[];

  /** Build the document — runs Pretext layout and returns draw commands. */
  build(): BuildResult;
}

// ─── Schema for renderFromSchema ──────────────────────────

export interface DocumentSchema {
  page?: PageConfig;
  colors?: ColorConfig;
  headerFooter?: HeaderFooterConfig | null;
  watermark?: WatermarkConfig | null;
  metadata?: MetadataConfig;
  blocks?: Block[];
}

// ─── Exported functions ───────────────────────────────────

/**
 * Create a document builder with a fluent API.
 */
export function createDocument(options?: DocumentOptions): DocumentBuilder;

/**
 * Render a JSON document schema directly to draw commands.
 * This is the template/data-driven API.
 */
export function renderFromSchema(schema: DocumentSchema): BuildResult;

/**
 * Create a flow engine for advanced layout control.
 */
export function createFlowEngine(
  pageW: number,
  pageH: number,
  margin: number,
  colors: ResolvedColorConfig,
  headerFooter: HeaderFooterConfig | null
): FlowEngine;

/**
 * Process an array of blocks through the flow engine.
 * Returns a FlowEngine with populated pages.
 */
export function processBlocks(
  blocks: Block[],
  pageW: number,
  pageH: number,
  margin: number,
  colors: ResolvedColorConfig,
  headerFooter: HeaderFooterConfig | null
): FlowEngine;

/**
 * Convert a hex color string (e.g. "#ff0000") to an RGB array with values 0-1.
 */
export function hexToRgbArr(hex: string): RgbColor;

/**
 * Map of page size names to their dimensions in points.
 */
export declare const PAGE_SIZES: Record<PageSizeName, PageSize>;
