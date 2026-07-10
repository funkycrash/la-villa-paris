# Assemble les pages comme Jekyll le ferait : stubs avec front matter, chaîne de
# layouts, includes (y compris paramétrés), site.data.i18n, site.static_files, site.faq.
require "liquid"
require "kramdown"
require "json"
require "fileutils"

REPO = File.expand_path("..", __dir__)
OUT = File.expand_path("preview", __dir__)
FileUtils.mkdir_p(OUT)

def front_matter(raw)
  return [{}, raw] unless raw =~ /\A---\n(.*?)\n---\n?(.*)\z/m
  meta_src, body = $1, $2 # capturer avant scan : scan écrase $1/$2
  meta = {}
  meta_src.scan(/^(\w+):\s*(.*)$/) { |k, v| meta[k] = v.strip.gsub(/\A['"]|['"]\z/, "") }
  [meta, body]
end

# Filtres Jekyll utilisés par les templates
module JekyllFilters
  def where(input, property, value)
    (input || []).select { |item| item[property] == value }
  end
  def jsonify(input) = JSON.generate(input)
  def normalize_whitespace(input) = input.to_s.gsub(/\s+/, " ")
end
Liquid::Template.register_filter(JekyllFilters)

# Tag {% include fichier.html cle="valeur" %} façon Jekyll
class JekyllInclude < Liquid::Tag
  def initialize(tag_name, markup, options)
    super
    @file = markup.strip.split(/\s+/).first
    @params = markup.scan(/(\w+)=("[^"]*"|'[^']*'|\S+)/)
                    .to_h.transform_values { |v| v.gsub(/\A['"]|['"]\z/, "") }
  end
  def render(context)
    tpl = Liquid::Template.parse(File.read(File.join(REPO, "_includes", @file)), error_mode: :strict)
    result = nil
    context.stack do
      context["include"] = @params
      result = tpl.render(context)
    end
    result
  end
end
Liquid::Template.register_tag("include", JekyllInclude)

# site.*
i18n = Dir[File.join(REPO, "_data/i18n/*.json")].to_h { |p| [File.basename(p, ".json"), JSON.parse(File.read(p))] }
static_files = Dir[File.join(REPO, "images/**/*")].select { |f| File.file?(f) }
                  .map { |f| { "path" => f.sub(REPO, "") } }
faq_docs = Dir[File.join(REPO, "_faq", "*.md")].map do |path|
  meta, body = front_matter(File.read(path))
  { "lang" => meta["lang"], "content" => Kramdown::Document.new(body, input: "GFM").to_html }
end
SITE = { "data" => { "i18n" => i18n }, "static_files" => static_files, "faq" => faq_docs }

def render_with_layout(layout_name, content, page)
  raw = File.read(File.join(REPO, "_layouts", "#{layout_name}.html"))
  meta, body = front_matter(raw)
  html = Liquid::Template.parse(body, error_mode: :strict)
                         .render!({ "page" => page, "site" => SITE, "content" => content })
  meta["layout"] ? render_with_layout(meta["layout"], html, page) : html
end

# Pages à assembler : stub réel -> fichier de sortie
stubs = {
  "index.md" => "index.html",
  "chambres.md" => "chambres.html",
  "photos.md" => "photos.html",
  "faq.md" => "faq.html",
  "reservation.md" => "reservation.html",
  "en/index.md" => "en/index.html",
  "en/chambres.md" => "en/chambres.html",
  "de/chambres.md" => "de/chambres.html",
  "es/photos.md" => "es/photos.html",
  "zh/faq.md" => "zh/faq.html",
  "en/faq.md" => "en/faq.html",
}
stubs.each do |stub, outname|
  meta, body = front_matter(File.read(File.join(REPO, stub)))
  page = { "layout" => meta["layout"], "lang" => meta["lang"], "pagekey" => meta["pagekey"],
           "url" => meta["permalink"], "title" => meta["title"] }
  html = render_with_layout(meta["layout"], body, page)
  dest = File.join(OUT, outname)
  FileUtils.mkdir_p(File.dirname(dest))
  File.write(dest, html)
  puts "assemblé #{outname} (#{html.bytesize} o)"
end

%w[css js images fonts].each do |dir|
  link = File.join(OUT, dir)
  File.symlink(File.join(REPO, dir), link) if File.exist?(File.join(REPO, dir)) && !File.exist?(link)
end
%w[favicon.svg favicon.ico apple-touch-icon.png].each do |f|
  link = File.join(OUT, f)
  File.symlink(File.join(REPO, f), link) unless File.exist?(link)
end
puts "preview prêt"
