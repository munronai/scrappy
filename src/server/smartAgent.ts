import path from 'node:path';
import {
  applyOperations,
  BoardDocument,
  BoundingBox,
  ChecklistItem,
  extractSpatialSlice,
  findContainingSection,
  GraphOp,
  PromptRequest,
  SectionNode,
  TableData,
  formatTableToMarkdown,
  validateGraphOpsBatch,
} from '../core/index.js';
import {
  compileCanvasToICMPipeline,
  matchPipelinesForPrompt,
} from '../icm/architect.js';

export function stripScrappyMention(raw: string): string {
  return raw.replace(/^@scrappy\b[:\s,-]*/i, '').trim() || raw.trim();
}

export function resolveScopedPlacement(
  board: BoardDocument,
  promptReq: PromptRequest,
  sliceSections: SectionNode[]
): {
  targetSectionId?: string;
  targetSection?: SectionNode;
  baseX: number;
  baseY: number;
  bbox?: BoundingBox;
} {
  const anchor = promptReq.anchorPosition;
  const containingSec = anchor ? findContainingSection(anchor, board.sections) : undefined;
  const promptLower = promptReq.prompt.toLowerCase();
  const mentionedSec = Object.values(board.sections).find((s) => {
    const cleanTitle = s.title.replace(/^\d+\.\s*/, '').toLowerCase();
    const normPrompt = promptLower.replace(/&/g, 'and');
    const normTitle = cleanTitle.replace(/&/g, 'and');
    return (
      (cleanTitle.length > 3 && normPrompt.includes(normTitle)) ||
      normPrompt.includes(s.slug.replace(/_/g, ' ').toLowerCase())
    );
  });

  const targetSectionId =
    promptReq.selectedSectionId ||
    mentionedSec?.id ||
    containingSec?.id;
  const targetSection = targetSectionId ? board.sections[targetSectionId] : undefined;

  // 1. If a Focus Region bounding box is active, clamp placement inside it
  if (promptReq.boundingBox) {
    const b = promptReq.boundingBox;
    const baseX = anchor
      ? Math.max(Math.round(b.x + 20), Math.min(Math.round(anchor.x), Math.round(b.x + b.width - 260)))
      : Math.round(b.x + 30);
    const baseY = anchor
      ? Math.max(Math.round(b.y + 20), Math.min(Math.round(anchor.y), Math.round(b.y + b.height - 150)))
      : Math.round(b.y + 30);
    return { targetSectionId, targetSection, baseX, baseY, bbox: b };
  }

  // 2. If a Scope Section is targeted, ensure placement is inside that section
  if (targetSection) {
    const b = targetSection.bounds;
    const insideSection =
      anchor &&
      anchor.x >= b.x &&
      anchor.x <= b.x + b.width - 100 &&
      anchor.y >= b.y &&
      anchor.y <= b.y + b.height - 80;

    if (insideSection && anchor) {
      return {
        targetSectionId,
        targetSection,
        baseX: Math.round(anchor.x),
        baseY: Math.round(anchor.y),
      };
    }

    const secNodes = Object.values(board.nodes).filter((n) => n.sectionId === targetSection.id);
    const col = secNodes.length % 2;
    const row = Math.floor(secNodes.length / 2);
    return {
      targetSectionId,
      targetSection,
      baseX: Math.round(b.x + 30 + col * 285),
      baseY: Math.round(b.y + 75 + row * 170),
    };
  }

  return {
    targetSectionId,
    targetSection,
    baseX: Math.round(anchor?.x ?? 200),
    baseY: Math.round(anchor?.y ?? 260),
  };
}

export function generateArtisticSvgGraphic(topic: string, _stages?: string[]): string {
  const safeTopic = topic.replace(/[<>&"]/g, '').slice(0, 42) || 'System Vision & Flow';
  return `<svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="orb1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <linearGradient id="orb2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="orb3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="560" height="320" rx="18" fill="url(#bgGrad)"/>
  <circle cx="95" cy="70" r="110" fill="#38bdf8" opacity="0.07"/>
  <circle cx="460" cy="250" r="130" fill="#a855f7" opacity="0.08"/>
  <!-- Artistic Curved Flow Waves -->
  <path d="M 60 185 C 170 95, 240 265, 340 165 C 410 105, 455 180, 505 145" fill="none" stroke="url(#orb1)" stroke-width="4" stroke-linecap="round"/>
  <path d="M 60 215 C 180 270, 260 110, 370 205 C 430 245, 465 160, 505 185" fill="none" stroke="url(#orb2)" stroke-width="2.5" stroke-dasharray="6 6"/>
  <!-- Stage Nodes -->
  <g transform="translate(55, 145)">
    <circle cx="35" cy="35" r="34" fill="url(#orb1)" opacity="0.9"/>
    <text x="35" y="39" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="800">IDEATE</text>
  </g>
  <g transform="translate(235, 130)">
    <circle cx="45" cy="45" r="44" fill="url(#orb2)" opacity="0.92"/>
    <text x="45" y="42" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">SYNTHESIZE</text>
    <text x="45" y="57" text-anchor="middle" fill="#f8fafc" font-size="9">@scrappy + ICM</text>
  </g>
  <g transform="translate(430, 125)">
    <circle cx="38" cy="38" r="37" fill="url(#orb3)" opacity="0.92"/>
    <text x="38" y="42" text-anchor="middle" fill="#052e16" font-size="11" font-weight="800">LAUNCH</text>
  </g>
  <!-- Title Banner -->
  <rect x="24" y="20" width="512" height="42" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(56,189,248,0.3)"/>
  <text x="280" y="46" text-anchor="middle" fill="#f8fafc" font-size="14" font-weight="700">✨ ${safeTopic}</text>
  <!-- Footer Metrics -->
  <text x="280" y="292" text-anchor="middle" fill="#94a3b8" font-size="11">Artistic Vector Interpretation • Scalable SVG Graphic Node</text>
</svg>`;
}

export async function executeStandaloneModelPrompt(
  board: BoardDocument,
  promptReq: PromptRequest,
  runtimeApiKey?: { provider?: 'gemini' | 'anthropic' | 'openai'; apiKey?: string }
): Promise<{ summary: string; opsCount: number; usedProvider: string }> {
  const cleanPrompt = stripScrappyMention(promptReq.prompt);
  const slice = extractSpatialSlice(board, {
    selectedOnly: promptReq.selectedNodeIds.length > 0,
    sectionId: promptReq.selectedSectionId,
    bbox: promptReq.boundingBox,
  });

  const placement = resolveScopedPlacement(board, promptReq, slice.sections);
  const geminiKey =
    (runtimeApiKey?.provider === 'gemini' ? runtimeApiKey.apiKey : undefined) ||
    process.env.GEMINI_API_KEY;
  const anthropicKey =
    (runtimeApiKey?.provider === 'anthropic' ? runtimeApiKey.apiKey : undefined) ||
    process.env.ANTHROPIC_API_KEY;
  const openaiKey =
    (runtimeApiKey?.provider === 'openai' ? runtimeApiKey.apiKey : undefined) ||
    process.env.OPENAI_API_KEY;

  const systemPrompt = [
    `You are @scrappy, a spatial whiteboard AI assistant collaborating on "${board.title}".`,
    `Place output inside Scope Section "${placement.targetSectionId || '00_scratchpad'}" starting near coordinates (${placement.baseX}, ${placement.baseY}).`,
    `User instruction: "${cleanPrompt}".`,
    `Available ready-made UI Library node types: "sticky", "shape", "checklist" (with content.checklistItems: [{id,text,checked}]), "mermaid" (with content.mermaidCode), "svg_graphic" (with content.svgCode), "suggestion".`,
    `Scoped Context (${slice.scopeDescription}, ~${slice.tokenEstimate} tokens):`,
    JSON.stringify(
      {
        sections: slice.sections.map((s) => ({ id: s.id, title: s.title, bounds: s.bounds })),
        nodes: slice.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          sectionId: n.sectionId,
          position: n.position,
          title: n.content.title,
          body: n.content.body,
          checklistItems: n.content.checklistItems,
        })),
        edges: slice.edges,
      },
      null,
      2
    ),
    `Respond ONLY with valid JSON matching: { "summary": "string", "operations": GraphOp[] }`,
  ].join('\n');

/**
 * Validates LLM-returned operations against `GraphOpsBatchSchema` before applying them.
 */
function applyValidatedLlmOperations(
  board: BoardDocument,
  parsed: unknown,
  actorId: string,
  usedProvider: string,
  providerLabel: string
): { summary: string; opsCount: number; usedProvider: string } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as { summary?: unknown; operations?: unknown };
  const validation = validateGraphOpsBatch(candidate.operations);
  if (!validation.success) {
    console.warn(`[Standalone Model API:${usedProvider}] Rejected invalid LLM operations:`, validation.error);
    return null;
  }

  applyOperations(board, validation.operations, actorId);
  return {
    summary:
      typeof candidate.summary === 'string' && candidate.summary.trim()
        ? candidate.summary
        : `Applied ${validation.operations.length} operations via ${providerLabel}`,
    opsCount: validation.operations.length,
    usedProvider,
  };
}

  try {
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      if (res.ok) {
        const data: any = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const result = applyValidatedLlmOperations(
            board,
            JSON.parse(rawJson),
            '@scrappy-gemini',
            'gemini-api',
            'Gemini API'
          );
          if (result) return result;
        }
      }
    } else if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 1800,
          messages: [{ role: 'user', content: systemPrompt }],
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const textBlock = data.content?.[0]?.text || '';
        const jsonMatch = textBlock.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = applyValidatedLlmOperations(
            board,
            JSON.parse(jsonMatch[0]),
            '@scrappy-claude',
            'anthropic-api',
            'Claude API'
          );
          if (result) return result;
        }
      }
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: systemPrompt }],
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const rawJson = data.choices?.[0]?.message?.content;
        if (rawJson) {
          const result = applyValidatedLlmOperations(
            board,
            JSON.parse(rawJson),
            '@scrappy-openai',
            'openai-api',
            'OpenAI API'
          );
          if (result) return result;
        }
      }
    }
  } catch (err) {
    console.warn('[Standalone Model API] Falling back to built-in spatial engine:', err);
  }

  const localRes = executeInstantAgentAction(board, promptReq);
  return {
    ...localRes,
    usedProvider: 'standalone-builtin',
  };
}

export function executeInstantAgentAction(
  board: BoardDocument,
  promptReq: PromptRequest
): { summary: string; opsCount: number } {
  const text = stripScrappyMention(promptReq.prompt);
  const lower = text.toLowerCase();
  const selectedIds = Array.isArray(promptReq.selectedNodeIds) ? promptReq.selectedNodeIds : [];

  const slice = extractSpatialSlice(board, {
    selectedOnly: selectedIds.length > 0,
    sectionId: promptReq.selectedSectionId,
    bbox: promptReq.boundingBox,
  });

  const placement = resolveScopedPlacement(board, promptReq, slice.sections);
  const { targetSectionId, targetSection, baseX, baseY } = placement;
  const ops: GraphOp[] = [];

  // 0A. Explicit "Scaffold / Build New ICM Pipeline (icm-architect)" Route
  if (
    promptReq.executionRoute === 'scaffold_pipeline' ||
    lower.includes('build icm pipeline') ||
    lower.includes('compile icm pipeline') ||
    lower.includes('create icm pipeline')
  ) {
    const boardDir = path.resolve(process.cwd(), 'boards', board.name || 'launch-plan');
    const compiled = compileCanvasToICMPipeline(boardDir, board, {
      title: text
        .replace(/^(build|compile|create)\s+(an?\s+)?icm\s+pipeline\s*(for|from|on)?\s*/i, '')
        .trim() || undefined,
      sectionId: targetSectionId,
      nodeIds: selectedIds.length > 0 ? selectedIds : undefined,
      reflectOnCanvas: true,
    });
    return {
      summary: `🏗️ icm-architect compiled ICM Pipeline "${compiled.pipeline.title}" (${compiled.pipeline.stages.length} stages → ${compiled.pipeline.routingPath}) | ${compiled.walkTest.summary}`,
      opsCount: compiled.pipeline.stages.length + 1,
    };
  }

  // 0B. Explicit "Run Governed ICM Pipeline" Route (from Top-Level Routing File `CONTEXT.md`)
  const availablePipelines = board.icmWorkspace?.pipelines || [];
  const matchedPipelines = matchPipelinesForPrompt(text, availablePipelines);
  const selectedPipeline =
    (promptReq.selectedPipelineId
      ? availablePipelines.find((p) => p.id === promptReq.selectedPipelineId)
      : undefined) ||
    (promptReq.executionRoute === 'pipeline' ? matchedPipelines[0] : undefined);

  if (selectedPipeline && promptReq.executionRoute !== 'adhoc') {
    const pipeId = selectedPipeline.id;
    if (pipeId === 'brand-image-gen' || selectedPipeline.outputWidgetType === 'svg_graphic') {
      const svgCode = generateArtisticSvgGraphic(
        `${text} [Brand Style: ${selectedPipeline.configRefs.join(', ')}]`,
        slice.nodes.map((n) => n.content.title || 'Stage')
      );
      const nodeId = `node-pipe-img-${Date.now().toString(36).slice(-4)}`;
      ops.push({
        op: 'create_node',
        node: {
          id: nodeId,
          type: 'svg_graphic',
          sectionId: targetSectionId,
          position: { x: baseX, y: baseY },
          size: { width: 450, height: 295 },
          content: {
            title: `🎯 [${selectedPipeline.title}] ${text.slice(0, 32)}`,
            body: `Generated via ICM Pipeline \`${selectedPipeline.routingPath}\` (${selectedPipeline.stages.join(' → ')}) enforcing ${selectedPipeline.configRefs.map((c) => `\`${c}\``).join(' & ')}.`,
            svgCode,
            tags: ['icm-pipeline', pipeId, 'brand-governed'],
          },
          style: { color: '#e0e7ff', shape: 'rect' },
        },
      });
    } else if (pipeId === 'video-content-gen' || pipeId === 'bug-triage-fix' || selectedPipeline.outputWidgetType === 'checklist') {
      const chkId = `node-pipe-chk-${Date.now().toString(36).slice(-4)}`;
      const items: ChecklistItem[] = selectedPipeline.stages.map((st, idx) => ({
        id: `st-${idx + 1}`,
        text: `[${st}] ${idx === 0 ? `Scope & Hook: ${text.slice(0, 36)}` : idx === 1 ? 'Apply _config/brand-guidelines.md & draft' : 'Final QA & verification gate'}`,
        checked: idx === 0,
      }));
      ops.push({
        op: 'create_node',
        node: {
          id: chkId,
          type: 'checklist',
          sectionId: targetSectionId,
          position: { x: baseX, y: baseY },
          size: { width: 320, height: 235 },
          content: {
            title: `🎯 [${selectedPipeline.title}]`,
            body: '',
            checklistItems: items,
            tags: ['icm-pipeline', pipeId],
          },
          style: { color: '#dcfce7', shape: 'rect' },
        },
      });
    } else {
      // Multi-stage pipeline execution cards (e.g. Slide Deck or custom icm-architect pipeline)
      let prevId: string | undefined;
      selectedPipeline.stages.forEach((stageSlug, idx) => {
        const stNodeId = `node-run-${pipeId}-${idx + 1}-${Date.now().toString(36).slice(-3)}`;
        ops.push({
          op: 'create_node',
          node: {
            id: stNodeId,
            type: 'sticky',
            sectionId: targetSectionId,
            position: { x: baseX + idx * 255, y: baseY },
            size: { width: 235, height: 145 },
            content: {
              title: `${stageSlug}`,
              body: `Executed stage ${idx + 1}/${selectedPipeline.stages.length} of **${selectedPipeline.title}** for: "${text.slice(0, 50)}"\n\nConfig: \`${selectedPipeline.configRefs[0] || '_config/brand-guidelines.md'}\``,
              tags: ['icm-pipeline', pipeId, stageSlug],
            },
            style: { color: idx === selectedPipeline.stages.length - 1 ? '#bbf7d0' : '#dbeafe', shape: 'rect' },
          },
        });
        if (prevId) {
          ops.push({
            op: 'create_edge',
            edge: {
              fromNodeId: prevId,
              toNodeId: stNodeId,
              label: 'handoff',
              style: 'solid',
              directed: true,
            },
          });
        }
        prevId = stNodeId;
      });
    }

    applyOperations(board, ops, `@scrappy:${selectedPipeline.id}`);
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `🎯 Executed ICM Pipeline "${selectedPipeline.title}" (${selectedPipeline.stages.join(' → ')}) with ${selectedPipeline.configRefs.join(', ')} at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 1. Actioning Open Items / Bugs from a Checklist Card in Scope!
  const checklistNodes = slice.nodes.filter(
    (n) =>
      n.type === 'checklist' &&
      n.content.checklistItems &&
      n.content.checklistItems.some((i) => !i.checked)
  );
  if (
    checklistNodes.length > 0 &&
    (lower.includes('action') ||
      lower.includes('fix') ||
      lower.includes('resolve') ||
      lower.includes('triage') ||
      lower.includes('bug'))
  ) {
    const sourceCard =
      (promptReq.targetNodeId && board.nodes[promptReq.targetNodeId]?.type === 'checklist'
        ? board.nodes[promptReq.targetNodeId]
        : undefined) || checklistNodes[0];

    const openItems = (sourceCard.content.checklistItems || []).filter((i) => !i.checked);
    openItems.slice(0, 4).forEach((item, idx) => {
      const actionNodeId = `node-bugfix-${Date.now().toString(36).slice(-3)}-${idx + 1}`;
      ops.push({
        op: 'create_node',
        node: {
          id: actionNodeId,
          type: 'shape',
          sectionId: sourceCard.sectionId || targetSectionId,
          position: {
            x: sourceCard.position.x + sourceCard.size.width + 60,
            y: sourceCard.position.y + idx * 145,
          },
          size: { width: 250, height: 125 },
          content: {
            title: `Action: ${item.text.slice(0, 32)}`,
            body: `Resolution plan generated by @scrappy for checklist item "${item.text}".`,
            tags: ['bug-action', 'scrappy'],
          },
          style: { color: '#bbf7d0', shape: 'rect' },
        },
      });
      ops.push({
        op: 'create_edge',
        edge: {
          fromNodeId: sourceCard.id,
          toNodeId: actionNodeId,
          label: 'actions bug',
          style: 'animated',
          directed: true,
        },
      });
    });

    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, sourceCard.sectionId || targetSectionId);
    return {
      summary: `@scrappy actioned ${openItems.length} open item(s) from checklist "${sourceCard.content.title}" inside ${slice.scopeDescription}.`,
      opsCount: ops.length,
    };
  }

  // 2. Create an Interactive Checklist Card (e.g. "checklist of bugs")
  if (lower.includes('checklist') || lower.includes('todo') || lower.includes('bug list')) {
    const items: ChecklistItem[] = [
      { id: 'bug-1', text: 'Resize scope sections & cards from corners', checked: true },
      { id: 'bug-2', text: 'Persist interactive checklist state across restarts', checked: false },
      { id: 'bug-3', text: 'Verify /update-scrappy focus region positioning', checked: false },
    ];
    const id = `node-checklist-${Date.now().toString(36).slice(-4)}`;
    ops.push({
      op: 'create_node',
      node: {
        id,
        type: 'checklist',
        sectionId: targetSectionId,
        position: { x: baseX, y: baseY },
        size: { width: 290, height: 220 },
        content: {
          title: text.slice(0, 40) || 'Interactive Bug Checklist',
          body: '',
          checklistItems: items,
          tags: ['checklist', 'ui-library'],
        },
        style: { color: '#fef08a', shape: 'rect' },
      },
    });
    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `@scrappy created persistent Interactive Checklist card "${id}" at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 3. Create a Live Mermaid Diagram Shape in-place
  if (lower.includes('mermaid') || lower.includes('sequence') || lower.includes('diagram')) {
    const id = `node-mermaid-${Date.now().toString(36).slice(-4)}`;
    const mermaidCode = lower.includes('sequence')
      ? `sequenceDiagram\n  participant U as User (Canvas)\n  participant S as @scrappy\n  participant I as ICM Files\n  U->>S: Right-click prompt\n  S->>I: Write ACTIVE_PROMPT.md\n  I-->>U: Live WebSocket Render`
      : `flowchart LR\n  A["User Right-Click"] --> B["@scrappy Prompt"]\n  B --> C{"Mode?"}\n  C -->|ICM| D["/update-scrappy"]\n  C -->|Standalone| E["Model API"]`;

    ops.push({
      op: 'create_node',
      node: {
        id,
        type: 'mermaid',
        sectionId: targetSectionId,
        position: { x: baseX, y: baseY },
        size: { width: 380, height: 250 },
        content: {
          title: `Mermaid: ${text.slice(0, 32)}`,
          body: '```mermaid\n' + mermaidCode + '\n```',
          mermaidCode,
          tags: ['mermaid', 'ui-library'],
        },
        style: { color: '#0f172a', shape: 'rect' },
      },
    });
    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `@scrappy created in-place Mermaid Diagram card "${id}" at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 4. Create an Artistic / Graphic Vector Illustration (`svg_graphic`)
  if (
    lower.includes('graphic') ||
    lower.includes('artistic') ||
    lower.includes('illustrat') ||
    lower.includes('visual') ||
    lower.includes('poster')
  ) {
    const id = `node-graphic-${Date.now().toString(36).slice(-4)}`;
    const svgCode = generateArtisticSvgGraphic(text);
    ops.push({
      op: 'create_node',
      node: {
        id,
        type: 'svg_graphic',
        sectionId: targetSectionId,
        position: { x: baseX, y: baseY },
        size: { width: 420, height: 260 },
        content: {
          title: `Graphic: ${text.slice(0, 34)}`,
          body: 'Artistic SVG graphic generated by @scrappy.',
          svgCode,
          tags: ['graphic', 'svg'],
        },
        style: { color: '#0f172a', shape: 'rect' },
      },
    });
    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `@scrappy created an artistic SVG graphic illustration at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 5. Create a Structured Data / Comparison Table Card (`table`)
  if (
    lower.includes('table') ||
    lower.includes('matrix') ||
    lower.includes('grid') ||
    lower.includes('comparison') ||
    lower.includes('pros and cons') ||
    lower.includes('benchmark')
  ) {
    const id = `node-table-${Date.now().toString(36).slice(-4)}`;
    const isComparison =
      lower.includes('comparison') || lower.includes('pros') || lower.includes('vs') || lower.includes('matrix');
    const tableData: TableData = isComparison
      ? {
          columns: ['Architecture Option', 'Pros & Strengths', 'Trade-offs / Cons', 'Evaluation / Verdict'],
          rows: [
            ['Option A (Node-per-file)', 'Zero merge conflicts, human-readable markdown', 'Requires sync layer', 'Recommended (Active)'],
            ['Option B (Monolithic JSON)', 'Single file storage', 'High git merge conflict rate', 'Avoid for large boards'],
            ['Option C (Git Worktrees)', 'Branch isolation', 'Higher complexity overhead', 'Advanced / optional'],
          ],
          stylePreset: 'sky',
          customStyleDescription: 'sky blue header with zebra stripes and rounded borders',
        }
      : {
          columns: ['Deliverable / Item', 'Owner', 'Status', 'Target Sprint'],
          rows: [
            ['Interactive Table Component', 'Scrappy Team', 'Done', 'Sprint 4'],
            ['Natural Language CSS Styler', 'Alex', 'Done', 'Sprint 4'],
            ['Visual Row & Column Builder', 'Jordan', 'Done', 'Sprint 4'],
            ['ICM Adapter Dual Markdown Sync', 'Taylor', 'Done', 'Sprint 4'],
          ],
          stylePreset: 'default',
          customStyleDescription: 'board theme with subtle borders',
        };

    const md = formatTableToMarkdown(tableData);
    ops.push({
      op: 'create_node',
      node: {
        id,
        type: 'table',
        sectionId: targetSectionId,
        position: { x: baseX, y: baseY },
        size: { width: 450, height: 285 },
        content: {
          title: `Table: ${text.slice(0, 34) || 'Data Matrix'}`,
          body: md,
          tableData,
          tags: ['table', 'ui-library'],
        },
        style: { color: '#0f172a', shape: 'rect' },
      },
    });
    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `@scrappy created interactive Table card "${id}" (${tableData.columns.length} columns x ${tableData.rows.length} rows) at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 5. Reorganize / Group by theme or timeline
  if (
    lower.includes('reorganize') ||
    lower.includes('regroup') ||
    lower.includes('group') ||
    lower.includes('tidy') ||
    lower.includes('layout')
  ) {
    ops.push({
      op: 'auto_layout',
      layout: lower.includes('flow') ? 'flowchart-lr' : 'sections',
      targetSectionId: promptReq.selectedSectionId,
      targetNodeIds: promptReq.selectedNodeIds.length > 0 ? promptReq.selectedNodeIds : undefined,
    });
    applyOperations(board, ops, '@scrappy');
    return {
      summary: `@scrappy reorganized ${slice.nodes.length} nodes in ${slice.scopeDescription} and updated _layout.json.`,
      opsCount: ops.length,
    };
  }

  // 6. Find the gaps between steps
  if (lower.includes('gap') || lower.includes('missing') || lower.includes('what else')) {
    const focusNodes = slice.nodes.filter((n) => n.type !== 'suggestion');
    const firstNode =
      (promptReq.targetNodeId ? board.nodes[promptReq.targetNodeId] : undefined) || focusNodes[0];
    const secondNode = focusNodes.find((n) => n.id !== firstNode?.id) || focusNodes[1];

    const sugId = `node-gap-${Date.now().toString(36).slice(-4)}`;
    ops.push({
      op: 'create_node',
      node: {
        id: sugId,
        type: 'suggestion',
        sectionId: targetSectionId,
        position: { x: baseX, y: baseY },
        size: { width: 255, height: 145 },
        content: {
          title: 'Gap: Validation & Telemetry Gate',
          body: `Suggested by @scrappy between "${firstNode?.content.title || 'Step A'}" and "${secondNode?.content.title || 'Step B'}": Verify error handling, permissions, and rollback criteria.`,
          tags: ['ai-gap', 'validation'],
        },
        style: { color: '#fde68a' },
        suggestionMeta: {
          promptId: promptReq.id,
          rationale: `Detected a transition in ${slice.scopeDescription} needing a verification gate.`,
          proposedEdges:
            firstNode && secondNode
              ? [
                  { fromNodeId: firstNode.id, toNodeId: sugId, label: 'validates' },
                  { fromNodeId: sugId, toNodeId: secondNode.id, label: 'clears' },
                ]
              : [],
        },
      },
    });

    applyOperations(board, ops, '@scrappy');
    ensureSectionFitsChildren(board, targetSectionId);
    return {
      summary: `@scrappy analyzed ${slice.scopeDescription} and placed a proposed gap card at (${baseX}, ${baseY}).`,
      opsCount: ops.length,
    };
  }

  // 7. Brain-dump / Process / Options to structured flow inside Focus Region / Scope Section
  const rawSegments = text
    .replace(/^(map|create|add|brain dump|plan|steps|options)[:\s-]*/i, '')
    .split(/(?:\r?\n|;|->|=>|\bstep\s+\d+:?|\b\d+\.\s+|,\s+(?:then|next|and then|finally)\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const steps =
    rawSegments.length >= 2
      ? rawSegments
      : [
          `1. ${text.slice(0, 52)}`,
          `2. Validate & Connect (${targetSection?.title || 'Canvas'})`,
        ];

  const palette = ['#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fbcfe8'];
  let prevId: string | undefined =
    promptReq.targetNodeId ||
    (promptReq.selectedNodeIds.length === 1 ? promptReq.selectedNodeIds[0] : undefined);

  steps.slice(0, 6).forEach((stepText, idx) => {
    const nodeId = `node-ai-${Date.now().toString(36).slice(-3)}-${idx + 1}`;
    const words = stepText.split(/\s+/);
    const title = words.slice(0, 5).join(' ').replace(/[:.-]+$/, '');
    ops.push({
      op: 'create_node',
      node: {
        id: nodeId,
        type: steps.length >= 3 ? 'shape' : 'sticky',
        sectionId: targetSectionId,
        position: {
          x: baseX + (idx % 2) * 275,
          y: baseY + Math.floor(idx / 2) * 160,
        },
        size: { width: 245, height: 135 },
        content: {
          title: title || `Step ${idx + 1}`,
          body: stepText,
          tags: ['scrappy'],
        },
        style: {
          color: palette[idx % palette.length],
          shape: idx === 0 ? 'pill' : 'rect',
        },
      },
    });

    if (prevId) {
      ops.push({
        op: 'create_edge',
        edge: {
          fromNodeId: prevId,
          toNodeId: nodeId,
          label: idx === 0 && promptReq.targetNodeId ? 'branches to' : 'next',
          style: 'solid',
          directed: true,
        },
      });
    }
    prevId = nodeId;
  });

  applyOperations(board, ops, '@scrappy');
  ensureSectionFitsChildren(board, targetSectionId);
  return {
    summary: `@scrappy created ${Math.min(steps.length, 6)} connected card(s) at (${baseX}, ${baseY}) inside "${targetSection?.title || slice.scopeDescription}".`,
    opsCount: ops.length,
  };
}

function ensureSectionFitsChildren(board: BoardDocument, sectionId?: string): void {
  if (!sectionId || !board.sections[sectionId]) return;
  const sec = board.sections[sectionId];
  const children = Object.values(board.nodes).filter((n) => n.sectionId === sectionId);
  if (children.length === 0) return;

  let maxRight = sec.bounds.x + sec.bounds.width;
  let maxBottom = sec.bounds.y + sec.bounds.height;
  for (const child of children) {
    maxRight = Math.max(maxRight, child.position.x + child.size.width + 30);
    maxBottom = Math.max(maxBottom, child.position.y + child.size.height + 30);
  }
  sec.bounds.width = maxRight - sec.bounds.x;
  sec.bounds.height = maxBottom - sec.bounds.y;
}
