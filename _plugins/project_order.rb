# Put site.projects in the order of _data/project_order.yml, so the home
# page and sitemap-main.xml can loop over it as is. Moving a project is
# then one line in one file, instead of renumbering every doc in between.
# A project the list leaves out goes last rather than vanishing.
Jekyll::Hooks.register :site, :post_read do |site|
  order = site.data["project_order"] || []
  docs = site.collections["projects"].docs
  names = docs.map(&:basename_without_ext)

  (names - order).each do |name|
    Jekyll.logger.warn "Project order:", "#{name} is not in _data/project_order.yml; listing it last"
  end
  (order - names).each do |name|
    Jekyll.logger.warn "Project order:", "#{name} in _data/project_order.yml matches no _projects/ file"
  end

  rank = order.each_with_index.to_h
  docs.replace(docs.each_with_index.sort_by { |doc, i| [rank.fetch(doc.basename_without_ext, order.size), i] }.map(&:first))
end
