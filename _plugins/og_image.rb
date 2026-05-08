require "cgi"

# Auto-fill `page.image` for documents that don't set one explicitly,
# pointing at dogimg (https://dogimg.vercel.app). With page.image
# populated, jekyll-seo-tag emits og:image, twitter:image, and
# twitter:card=summary_large_image once each — no duplicates from a
# fallback <meta> block in the layout.
#
# Coverage:
#   - site.documents : posts + every collection doc (so _projects/*.md
#     gets covered too, regardless of its `layout: project`).
#   - site.pages with layout == "default" : top-level user-facing HTML
#     (index, about, blog, resume*). Skips XML/feed/verification files,
#     which have no layout.
Jekyll::Hooks.register :site, :post_read do |site|
  base = site.config["url"].to_s.chomp("/")
  fill = lambda do |item|
    next if item.data["image"]
    encoded = CGI.escape(base + item.url)
    item.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
  end

  site.documents.each(&fill)

  site.pages.each do |page|
    next unless page.data["layout"] == "default"
    fill.call(page)
  end
end
