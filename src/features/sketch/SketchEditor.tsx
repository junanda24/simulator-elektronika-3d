import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';

/**
 * Editor sketch (CodeMirror 6, mode C++) dengan tema mengikuti
 * STYLE_GUIDE: panel #12151C, teks zinc, aksen cyan untuk seleksi.
 */

const workbenchTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: '#12151C',
      color: '#e4e4e7',
      fontSize: '12.5px',
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', monospace",
      caretColor: '#00E5FF',
      padding: '10px 0',
    },
    '.cm-gutters': {
      backgroundColor: '#12151C',
      color: '#52525b',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(0,229,255,0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#a1a1aa' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(0,229,255,0.22)',
    },
    '.cm-cursor': { borderLeftColor: '#00E5FF' },
  },
  { dark: true },
);

interface SketchEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SketchEditor({ value, onChange }: SketchEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const externalValueRef = useRef(value);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: externalValueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        cpp(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        workbenchTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            externalValueRef.current = next;
            onChangeRef.current(next);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sinkronkan perubahan eksternal (mis. Muat Demo mengganti sketch)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      externalValueRef.current = value;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="h-full overflow-hidden" />;
}
