import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { TableKit, TableCell, TableHeader } from "@tiptap/extension-table";
import { Bold, ChevronDown, ImagePlus, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ISSUE_DOCUMENT_PREFIX, issueFontSize, safeIssueUrl } from "@shared/issueDocument";
import { issueEditorDocument } from "@shared/issueBody";
import { uploadIssueImage } from "@/lib/issueImages";

const SafeImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), src: {
      default: null,
      parseHTML: element => safeIssueUrl(element.getAttribute("src")) || null,
      renderHTML: attributes => ({ src: safeIssueUrl(attributes.src) || "" }),
    } };
  },
});
const SafeFontSize = FontSize.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: {
      default: null,
      parseHTML: element => issueFontSize(element.style.fontSize) || null,
      renderHTML: attributes => issueFontSize(attributes.fontSize) ? { style: `font-size: ${issueFontSize(attributes.fontSize)}` } : {},
    } } }];
  },
});
const alignmentAttribute = {
  textAlign: {
    default: "left",
    parseHTML: (element: HTMLElement) => element.style.textAlign || "left",
    renderHTML: (attrs: Record<string, unknown>) => ({ style: `text-align:${["left", "center", "right"].includes(String(attrs.textAlign)) ? attrs.textAlign : "left"}` }),
  },
};
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: { autolink: true, linkOnPaste: true, defaultProtocol: "https", openOnClick: false },
  }), SafeImage, TextStyle, SafeFontSize,
  TableKit.configure({ tableCell: false, tableHeader: false }),
  TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...alignmentAttribute }; } }),
  TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...alignmentAttribute }; } }),
];

export default function IssueBodyEditor({ value, disabled, onChange, onUpload, onBusyChange }: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onUpload: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState("17");
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const editor = useEditor({
    extensions,
    content: issueEditorDocument(value),
    immediatelyRender: false,
    editorProps: { attributes: { id: "issue-body", class: "issueRichContent", "aria-label": "이슈 본문", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(ISSUE_DOCUMENT_PREFIX + JSON.stringify(editor.getJSON())),
  });
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    size: editor?.getAttributes("textStyle").fontSize || (editor?.isActive("heading", { level: 2 }) ? "24px" : editor?.isActive("heading", { level: 3 }) ? "20px" : "17px"),
    bold: editor?.isActive("bold"), italic: editor?.isActive("italic"),
    bullet: editor?.isActive("bulletList"), ordered: editor?.isActive("orderedList"),
    heading: editor?.isActive("heading", { level: 2 }) ? "2" : editor?.isActive("heading", { level: 3 }) ? "3" : "0",
    undo: editor?.can().undo(), redo: editor?.can().redo(),
  }) });
  useEffect(() => { setFontSize(String(Number.parseFloat(state?.size || "17"))); }, [state?.size]);
  useEffect(() => { editor?.setEditable(!disabled && !uploading); }, [editor, disabled, uploading]);
  const applySize = (value = fontSize) => {
    const size = Number(value);
    if (!Number.isFinite(size) || size < 10 || size > 72) {
      setFontSize(String(Number.parseFloat(state?.size || "17")));
      setError("글자 크기는 10~72px로 입력해 주세요.");
      return;
    }
    setError("");
    setFontSize(String(size));
    setSizeMenuOpen(false);
    editor?.chain().focus().setFontSize(`${size}px`).run();
  };
  const attachImage = async (file?: File) => {
    if (!file || !editor || disabled || uploading) return;
    setUploading(true);
    onBusyChange(true);
    setError("");
    try {
      const { url } = await uploadIssueImage(file);
      onUpload(url);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (error) {
      setError(error instanceof Error ? error.message : "이미지를 첨부하지 못했습니다.");
    } finally {
      setUploading(false);
      onBusyChange(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return <div className="issueEditor">
    <div className="issueBodyToolbar" role="toolbar" aria-label="본문 서식">
      <fieldset disabled={disabled || uploading || !editor} className="issueEditorControls">
        <button type="button" title="굵게" aria-label="굵게" aria-pressed={state?.bold || false} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button type="button" title="기울임" aria-label="기울임" aria-pressed={state?.italic || false} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <select aria-label="본문 서식" value={state?.heading || "0"} onChange={event => { const level = Number(event.target.value); if (level) editor?.chain().focus().setHeading({ level: level as 2 | 3 }).run(); else editor?.chain().focus().setParagraph().run(); }}>
          <option value="0">본문</option><option value="3">소제목</option><option value="2">큰 소제목</option>
        </select>
        <Popover open={sizeMenuOpen && !disabled && !uploading} onOpenChange={setSizeMenuOpen}>
          <PopoverAnchor asChild><div className="issueFontSize" data-font-size-control>
            <input type="number" aria-label="본문 글자 크기 (px)" min="10" max="72" step="1" value={fontSize}
              onClick={() => setSizeMenuOpen(true)}
              onChange={event => setFontSize(event.target.value)}
              onBlur={event => {
                if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-font-size-control]"))) applySize();
              }}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applySize(); } if (event.key === "Escape") setSizeMenuOpen(false); }} />
            <span>px</span>
            <PopoverTrigger asChild><button type="button" className="issueFontSizeTrigger" aria-label="글자 크기 목록" title="글자 크기 선택"><ChevronDown size={13} /></button></PopoverTrigger>
          </div></PopoverAnchor>
          <PopoverContent side="bottom" align="start" className="issueFontSizeMenu" data-font-size-control onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <div role="listbox" aria-label="글자 크기 선택">
              {[10, 12, 14, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72].map(size => (
                <button type="button" role="option" key={size} aria-selected={Number(fontSize) === size}
                  onMouseDown={event => event.preventDefault()} onClick={() => applySize(String(size))}>{size}</button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button type="button" title="글머리 기호" aria-label="글머리 기호" aria-pressed={state?.bullet || false} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></button>
        <button type="button" title="번호 목록" aria-label="번호 목록" aria-pressed={state?.ordered || false} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
        <button type="button" title="본문 이미지 첨부" aria-label="본문 이미지 첨부" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /></button>
        <button type="button" title="실행 취소" aria-label="실행 취소" disabled={!state?.undo} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button>
        <button type="button" title="다시 실행" aria-label="다시 실행" disabled={!state?.redo} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button>
      </fieldset>
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void attachImage(event.target.files?.[0])} />
    <EditorContent editor={editor} />
    {uploading && <p className="issueEditorStatus" role="status">이미지 첨부 중…</p>}
    {error && <p className="issueEditorError" role="alert">{error}</p>}
  </div>;
}
