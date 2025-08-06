// Web Scraping Module - Extract content from URLs for indexing
import { ApiResponse } from "@/types";

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
  size: number;
  mimeType: string;
}

export class WebScraper {
  /**
   * Scrape content from a URL
   */
  static async scrapeUrl(url: string): Promise<ApiResponse<ScrapedContent>> {
    try {
      // Validate URL
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch {
        return {
          success: false,
          error: "Invalid URL format",
        };
      }

      // Only allow HTTP/HTTPS protocols
      if (!["http:", "https:"].includes(validUrl.protocol)) {
        return {
          success: false,
          error: "Only HTTP and HTTPS URLs are supported",
        };
      }

      console.log(`Scraping URL: ${url}`);

      // Fetch the webpage
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBase/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") || "";

      // Check if it's HTML content
      if (!contentType.includes("text/html")) {
        return {
          success: false,
          error: "URL does not contain HTML content",
        };
      }

      const html = await response.text();
      const extracted = this.extractContentFromHtml(html, url);

      return {
        success: true,
        data: {
          title: extracted.title || validUrl.hostname,
          content: extracted.content,
          url: url,
          size: extracted.content.length,
          mimeType: "text/html",
        },
      };
    } catch (error) {
      console.error("Web scraping error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown scraping error",
      };
    }
  }

  /**
   * Extract title and content from HTML
   */
  private static extractContentFromHtml(
    html: string,
    url: string
  ): {
    title: string;
    content: string;
  } {
    // Simple HTML parsing without external dependencies
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Remove script and style tags
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    // Extract text content from common content areas
    const contentSelectors = [
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    let extractedContent = "";
    for (const selector of contentSelectors) {
      const matches = content.match(selector);
      if (matches && matches.length > 0) {
        extractedContent = matches.join(" ");
        break;
      }
    }

    // If no specific content area found, use body
    if (!extractedContent) {
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      extractedContent = bodyMatch ? bodyMatch[1] : content;
    }

    // Remove HTML tags and clean up text
    const cleanContent = extractedContent
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/&nbsp;/g, " ") // Replace &nbsp;
      .replace(/&amp;/g, "&") // Replace &amp;
      .replace(/&lt;/g, "<") // Replace &lt;
      .replace(/&gt;/g, ">") // Replace &gt;
      .replace(/&quot;/g, '"') // Replace &quot;
      .trim();

    return {
      title: title || `Content from ${new URL(url).hostname}`,
      content: cleanContent || "No content could be extracted from this URL.",
    };
  }

  /**
   * Validate if a URL is scrapeable
   */
  static isValidUrl(url: string): boolean {
    try {
      const validUrl = new URL(url);
      return ["http:", "https:"].includes(validUrl.protocol);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const webScraper = new WebScraper();
