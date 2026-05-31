"use client";

import { useTranslations } from "next-intl";
import type { Template } from "./TemplateGrid";

type TemplatePreviewDialogProps = {
  template: Template | null;
  onClose: () => void;
  onUseTemplate: (template: Template) => void;
};

export function TemplatePreviewDialog({
  template,
  onClose,
  onUseTemplate,
}: TemplatePreviewDialogProps) {
  const t = useTranslations();
  return (
    <div className="as-preview-layer" hidden={!template}>
      {template ? (
        <article
          className="as-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <button
            className="as-preview-close"
            type="button"
            aria-label={t("templatePreview.close")}
            onClick={onClose}
          >
            ×
          </button>
          <div className="as-preview-visual">
            {template.imageSrc ? (
              /* 真图模板:完整原比例展示(无裁剪),让用户判断是否符合需求 */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={template.imageSrc}
                alt={template.title}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "480px",
                  objectFit: "contain",
                  display: "block",
                  borderRadius: "10px",
                  background: "#f5f4f0",
                }}
              />
            ) : (
              <div className={`as-thumb ${template.thumbClass}`}>
                <strong>{template.headline}</strong>
                {template.subhead ? <span>{template.subhead}</span> : null}
              </div>
            )}
          </div>
          <div className="as-preview-copy">
            <span>{template.niche}</span>
            <h2 id="preview-title">{template.title}</h2>
            <p>
              {template.uses}.{" "}
              {template.oneLiner ?? t("templatePreview.defaultDesc")}
            </p>
            <div className="as-preview-actions">
              <button type="button" onClick={() => onUseTemplate(template)}>
                {t("templatePreview.useTemplate")}
              </button>
              <button type="button" onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}
