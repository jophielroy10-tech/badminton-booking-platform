import type React from "react";

export type DashboardMenuChild = {
  title: string;
  href: string;
};

export type DashboardMenuItem = {
  title: string;
  icon?: React.ElementType;
  href?: string;
  children?: DashboardMenuChild[];
};
