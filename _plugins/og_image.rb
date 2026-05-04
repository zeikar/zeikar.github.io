require "cgi"

# Auto-fill `page.image` for documents that don't set one explicitly,
# pointing at dogimg (https://dogimg.vercel.app). With page.image
# populated, jekyll-seo-tag emits og:image, twitter:image, and
# twitter:card=summary_large_image once each — no duplicates from a
# fallback <meta> block in the layout.
#
# Posts are always covered. For non-post pages we only fill when the
# layout is `default`, which is the user-facing HTML pages (index,
# about, blog, resume*) and skips XML/feed/verification files.
Jekyll::Hooks.register :site, :post_read do |site|
  base = site.config["url"].to_s.chomp("/")
  fill = lambda do |item|
    next if item.data["image"]
    encoded = CGI.escape(base + item.url)
    item.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
  end

  site.posts.docs.each(&fill)

  site.pages.each do |page|
    next unless page.data["layout"] == "default"
    fill.call(page)
  end
end
