"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ImageUploadCropProps {
  value?: string;
  onChange: (base64: string) => void;
  aspect?: number;
  className?: string;
}

export default function ImageUploadCrop({
  value,
  onChange,
  aspect = 1,
  className = "",
}: ImageUploadCropProps) {
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [hovering, setHovering] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const next = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, aspect, width, height),
      width,
      height
    );
    setCrop(next);
    setCompletedCrop({ x: next.x ?? 0, y: next.y ?? 0, width: next.width ?? width, height: next.height ?? height, unit: "px" });
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Máximo 5 MB."); return; }
    if (!file.type.startsWith("image/")) { alert("Apenas imagens."); return; }
    const reader = new FileReader();
    reader.addEventListener("load", () => setImgSrc(reader.result?.toString() || ""));
    reader.readAsDataURL(file);
  }

  const confirmCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;
    const canvas = document.createElement("canvas");
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(completedCrop.width * dpr);
    canvas.height = Math.floor(completedCrop.height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, completedCrop.width, completedCrop.height);
    onChange(canvas.toDataURL("image/jpeg", 0.92));
    setImgSrc("");
  }, [completedCrop, onChange]);

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setImgSrc("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className={className}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectFile} className="hidden" />

      {/* ── Upload area / Preview ── */}
      <button
        type="button"
        onClick={() => !value && fileInputRef.current?.click()}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="relative w-full aspect-square rounded-xl overflow-hidden transition-all duration-200 cursor-pointer"
        style={{
          background: value ? "transparent" : "hsl(var(--muted))",
          border: `1.5px dashed ${value ? "transparent" : hovering ? "rgb(var(--primary-500))" : "hsl(var(--border))"}`,
          outline: "none",
        }}
        title={value ? "Clique para remover ou trocar" : "Clique para enviar logo"}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Logo"
              className="w-full h-full object-contain rounded-xl"
              style={{ background: "hsl(var(--muted)/0.4)" }}
            />
            {/* Overlay ao hover */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl transition-opacity duration-150"
              style={{
                background: "rgba(0,0,0,0.52)",
                opacity: hovering ? 1 : 0,
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white transition-colors"
                style={{ background: "rgb(var(--primary-500))", border: "none" }}
              >
                <ImagePlus size={11} /> Trocar
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white transition-colors"
                style={{ background: "rgba(239,68,68,0.85)", border: "none" }}
              >
                <Trash2 size={11} /> Remover
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full p-2">
            <div
              className="w-8 h-8 rounded-lg grid place-items-center transition-colors"
              style={{ background: hovering ? "rgb(var(--primary-500) / 0.15)" : "hsl(var(--muted))", color: hovering ? "rgb(var(--primary-500))" : "hsl(var(--muted-foreground))" }}
            >
              <ImagePlus size={16} />
            </div>
            <p className="text-[10px] font-medium text-muted-foreground leading-tight text-center">
              {hovering ? "Selecionar" : "Logo"}
            </p>
          </div>
        )}
      </button>

      {/* ── Crop modal ── */}
      <AnimatePresence>
        {imgSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="w-full max-w-lg bg-card border border-border flex flex-col overflow-hidden"
              style={{ borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", maxHeight: "88dvh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Ajustar imagem</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Arraste para reposicionar o recorte</p>
                </div>
                <button
                  type="button"
                  onClick={() => setImgSrc("")}
                  className="w-7 h-7 rounded-md grid place-items-center bg-muted border border-border cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Crop area */}
              <div className="overflow-auto flex-1 p-4 flex items-center justify-center bg-muted/30">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  keepSelection
                  minWidth={60}
                  minHeight={60}
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Crop preview"
                    className="max-w-full max-h-[50vh] rounded-lg"
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>

              {/* Footer */}
              <div className="flex gap-2 px-5 py-3.5 border-t border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setImgSrc("")}
                  className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground border border-border bg-card cursor-pointer hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCrop}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                  style={{ background: "rgb(var(--primary-500))", border: "none", boxShadow: "0 2px 8px -1px rgb(var(--primary-500)/0.4)" }}
                >
                  <Check size={14} /> Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
