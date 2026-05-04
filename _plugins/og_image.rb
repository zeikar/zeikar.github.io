require "cgi"

# Auto-fill `page.image` for posts that don't set one explicitly. Points at
# dogimg (https://dogimg.vercel.app), which renders an OG card from the
# post's URL. With page.image populated, jekyll-seo-tag emits og:image,
# twitter:image, and twitter:card=summary_large_image once each — no
# duplicates from a fallback <meta> block in the layout.
Jekyll::Hooks.register :posts, :pre_render do |post|
  next if post.data["image"]

  base = post.site.config["url"].to_s.chomp("/")
  encoded = CGI.escape(base + post.url)
  post.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
end
