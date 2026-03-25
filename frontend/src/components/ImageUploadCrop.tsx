"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Upload, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  className = "" 
}: ImageUploadCropProps) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    if (!aspect) return;
    const { width, height } = event.currentTarget;
    const nextCrop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 80
        },
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(nextCrop);
    setCompletedCrop({
      x: nextCrop.x ?? 0,
      y: nextCrop.y ?? 0,
      width: nextCrop.width ?? width,
      height: nextCrop.height ?? height,
      unit: "px"
    });
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Imagem muito grande. Máximo 5MB.");
        return;
      }
      
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        alert("Apenas imagens são permitidas.");
        return;
      }
      
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(file);
    }
  }

  const getCroppedImg = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement("canvas");
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(completedCrop.width * pixelRatio);
    canvas.height = Math.floor(completedCrop.height * pixelRatio);
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    const base64Image = canvas.toDataURL("image/jpeg", 0.9);
    onChange(base64Image);
    setImgSrc("");
  }, [completedCrop, onChange]);

  function handleRemove() {
    onChange("");
    setImgSrc("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onSelectFile}
        className="hidden"
      />

      {!value && !imgSrc && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-neutral-800 bg-neutral-950/50 transition-colors hover:border-purple-500 hover:bg-neutral-900"
        >
          <div className="text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-neutral-500" />
            <p className="text-sm font-medium text-neutral-300">Upload Logo</p>
            <p className="text-xs text-neutral-500">Clique para selecionar</p>
          </div>
        </button>
      )}

      {value && !imgSrc && (
        <div className="relative">
          <img
            src={value}
            alt="Logo"
            className="h-32 w-32 rounded-lg border border-neutral-800 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {imgSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 p-6"
            >
              <h3 className="mb-4 text-lg font-semibold text-neutral-100">
                Ajustar Imagem
              </h3>

              <div className="mb-4 max-h-96 overflow-auto">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  keepSelection
                  minWidth={80}
                  minHeight={80}
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Crop"
                    className="max-w-full"
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setImgSrc("")}
                  className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={getCroppedImg}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-glow"
                >
                  <Check className="h-4 w-4" />
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
