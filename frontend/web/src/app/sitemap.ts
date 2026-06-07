import type { MetadataRoute } from "next";
import collegesData from "@/lib/seo_data/colleges.json";
import cutoffsData from "@/lib/seo_data/cutoffs.json";
import guidesData from "@/lib/seo_data/guides.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://admitos.in";

  // Base paths
  const basePaths = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/rank-radar`, lastModified: new Date() },
    { url: `${baseUrl}/chat`, lastModified: new Date() },
  ];

  // College paths
  const collegePaths = (collegesData as any[]).map((c) => ({
    url: `${baseUrl}/colleges/${c.code}`,
    lastModified: new Date(),
  }));

  // Cutoff paths
  const cutoffPaths = (cutoffsData as any[]).map((c) => ({
    url: `${baseUrl}/cutoffs/${c.college}/${c.branch}/${c.category}`,
    lastModified: new Date(),
  }));

  // Guide paths
  const guidePaths = (guidesData as any[]).map((g) => ({
    url: `${baseUrl}/guides/${g.slug}`,
    lastModified: new Date(),
  }));

  return [...basePaths, ...collegePaths, ...cutoffPaths, ...guidePaths];
}
