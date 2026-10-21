import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';

/**
 * Editor sketch (CodeMirror 6, mode C++) dengan tema mengikuti
 * STYLE_GUIDE: panel #12151C, teks zinc, aksen cyan untuk seleksi.
 * Baris yang disebut pesan error sketch mendapat latar merah tipis
 * (danger #FF2A54) agar pengguna langsung melihat letak kesalahannya.
 * Baris yang sedang dieksekusi sketch mendapat latar cyan lembut —
 * deklarasi CSS-nya sebelum error-line agar error tetap menang bila
 * kedua dekorasi jatuh pada baris yang sama.
 */

const setErrorLineEffect = StateEffect.define<number | null>();

const errorLineDecoration = Decoration.line({ class: 'cm-sketch-error-line' });

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setErrorLineEffect)) {
        if (effect.value === null || effect.value < 1 || effect.value > tr.state.doc.lines) {
          next = Decoration.none;
        } else {
          const line = tr.state.doc.line(effect.value);
          next = Decoration.set([errorLineDecoration.range(line.from)]);
        }
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const setExecLineEffect = StateEffect.define<number | null>();

const execLineDecoration = Decoration.line({ class: 'cm-sketch-exec-line' });

const execLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setExecLineEffect)) {
        if (effect.value === null || effect.value < 1 || effect.value > tr.state.doc.lines) {
          next = Decoration.none;
        } else {
          const line = tr.state.doc.line(effect.value);
          next = Decoration.set([execLineDecoration.range(line.from)]);
        }
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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
    // Deklarasi exec-line SENGAJA sebelum error-line: bila satu baris
    // kena keduanya, aturan yang terdeklarasi belakangan (error) menang.
    '.cm-sketch-exec-line': { backgroundColor: 'rgba(0,229,255,0.10)' },
    '.cm-sketch-error-line': { backgroundColor: 'rgba(255,42,84,0.14)' },
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
  /** Baris (1-based) yang disebut pesan error sketch; null = tanpa tanda. */
  errorLine?: number | null;
  /** Baris (1-based) yang sedang dieksekusi sketch; null = tanpa sorot. */
  execLine?: number | null;
}

export default function SketchEditor({ value, onChange, errorLine = null, execLine = null }: SketchEditorProps) {
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
        errorLineField,
        execLineField,
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

  // Tandai baris yang salah; dekorasi mengikuti teks baris itu saat
  // dokumen disunting (posisi dipetakan CodeMirror lewat perubahan).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setErrorLineEffect.of(errorLine) });
  }, [errorLine]);

  // Sorot baris yang sedang dieksekusi; nilainya datang dari store
  // (currentLine sesi) dan menjadi null begitu sketch berhenti.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setExecLineEffect.of(execLine) });
  }, [execLine]);

  return <div ref={hostRef} className="h-full overflow-hidden" />;
}
