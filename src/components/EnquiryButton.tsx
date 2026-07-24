"use client";

import { useState } from "react";
import EnquiryModal from "./EnquiryModal";
import { useExperience } from "@/hooks/useExperience";

interface EnquiryButtonProps {
  treatmentName: string;
  productName: string;
  treatmentSlug?: string;
  className?: string;
  label?: string;
  full?: boolean;
}

export default function EnquiryButton({
  treatmentName,
  productName,
  treatmentSlug,
  className,
  label = "Enquiry to order",
  full = false,
}: EnquiryButtonProps) {
  const [open, setOpen] = useState(false);
  const { experience } = useExperience("doctor");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? `btn-primary ${full ? "w-full" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M3 7.5 12 3l9 4.5M3 7.5 12 12m-9-4.5V16l9 5m0-9v9m0-9 9-4.5M21 7.5V16l-9 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </button>
      <EnquiryModal
        open={open}
        onClose={() => setOpen(false)}
        treatmentName={treatmentName}
        productName={productName}
        treatmentSlug={treatmentSlug}
        audience={experience}
      />
    </>
  );
}
