"use client";

import React from "react";
import { formatCurrency } from "../../lib/utils";

type CollectionPulseProps = {
  collectedThisMonth: number;
};

const SAMPLE_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const SAMPLE_HEIGHTS = [34, 48, 39, 67, 56, 82];

export function CollectionPulse({ collectedThisMonth }: CollectionPulseProps) {
  return (
    <section className="collection-strip" aria-label="Collection trend">
      <div className="collection-copy">
        <div className="section-kicker">COLLECTION PULSE</div>
        <strong>Steady progress, one follow-up at a time.</strong>
        <span>Illustrative monthly trend</span>
      </div>

      <div className="trend-chart" aria-label="Monthly sample collections">
        {SAMPLE_HEIGHTS.map((height, index) => (
          <div className="trend-month" key={index}>
            <span
              className={`trend-bar ${index === SAMPLE_HEIGHTS.length - 1 ? "trend-current" : ""}`}
              style={{ height: `${height}%` }}
            />
            <small>{SAMPLE_MONTHS[index]}</small>
          </div>
        ))}
      </div>

      <div className="trend-total">
        <small>THIS MONTH</small>
        <strong>{formatCurrency(collectedThisMonth)}</strong>
        <span>
          <i /> Payment value recorded
        </span>
      </div>
    </section>
  );
}

