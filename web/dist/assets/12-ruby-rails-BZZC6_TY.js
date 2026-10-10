var e=`# Ruby / Rails

Works with Rails 7+, Sinatra, Hanami, or plain Ruby.

## Setup

\`\`\`bash
# Gemfile
gem 'httparty'  # or use Net::HTTP (stdlib)
\`\`\`

**Environment variables** (\`.env\` or Rails credentials):

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`lib/moogo.rb\`)

\`\`\`ruby
# lib/moogo.rb
require 'net/http'
require 'json'
require 'uri'

class Moogo
  PROJECT_URL = ENV['MOOGO_PROJECT_URL']
  SECRET_KEY  = ENV['MOOGO_SECRET_KEY']
  BUCKET_ENDPOINT = ENV['MOOGO_BUCKET_ENDPOINT']
  BUCKET_ACCESS_KEY_ID = ENV['MOOGO_BUCKET_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = ENV['MOOGO_BUCKET_SECRET_KEY']

  SQL_HEADERS = { 'Authorization' => "Bearer #{SECRET_KEY}", 'Content-Type' => 'application/json' }
  STORAGE_HEADERS = { 'X-Moogo-Access-Key-Id' => BUCKET_ACCESS_KEY_ID, 'Authorization' => "Bearer #{BUCKET_SECRET_KEY}" }

  class Error < StandardError
    attr_reader :code, :detail, :status
    def initialize(error, status = nil)
      @code = error['code']
      @detail = error['detail']
      @status = status
      super(error['message'])
    end
  end

  def self.request(method, path, body: nil, headers: SQL_HEADERS)
    uri = URI("#{PROJECT_URL}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = case method
          when :get then Net::HTTP::Get.new(uri)
          when :post then Net::HTTP::Post.new(uri)
          when :delete then Net::HTTP::Delete.new(uri)
          end
    headers.each { |k, v| req[k] = v }
    req.body = body.to_json if body

    res = http.request(req)
    body = JSON.parse(res.body)
    raise Error.new(body['error'], res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    body
  end

  def self.read?(sql)
    # \`with\` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b/i)
  end

  # ── SQL ────────────────────────────────────────────────────────────
  def self.query(sql, args = [])
    request(:post, '/query', body: { query: sql, args: args })
  end

  def self.exec(sql, args = [])
    request(:post, '/exec', body: { query: sql, args: args })
  end

  def self.sql(sql, args = [])
    read?(sql) ? query(sql, args) : exec(sql, args)
  end

  def self.to_objects(result)
    cols = result['columns'] || []
    (result['rows'] || []).map { |row| cols.zip(row).to_h }
  end

  # ── Bucket ─────────────────────────────────────────────────────────
  def self.bucket_request(method, path, body: nil, extra_headers: {})
    uri = URI("#{BUCKET_ENDPOINT}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = case method
          when :get then Net::HTTP::Get.new(uri)
          when :post then Net::HTTP::Post.new(uri)
          when :delete then Net::HTTP::Delete.new(uri)
          end
    STORAGE_HEADERS.merge(extra_headers).each { |k, v| req[k] = v }
    req.body = body if body

    res = http.request(req)
    return '' if res.code == '204'
    body = JSON.parse(res.body)
    raise Error.new(body['error'], res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    body
  end

  def self.bucket_upload(key, content, content_type)
    bucket_request(:post, "/#{key}", body: content, extra_headers: { 'Content-Type' => content_type })
  end

  def self.bucket_download(key)
    uri = URI("#{BUCKET_ENDPOINT}/#{key}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    req = Net::HTTP::Get.new(uri)
    STORAGE_HEADERS.each { |k, v| req[k] = v }
    res = http.request(req)
    raise Error.new({ 'code' => 'download_failed' }, res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    res.body
  end

  def self.bucket_delete(key)
    bucket_request(:delete, "/#{key}")
  end

  def self.bucket_list(prefix = nil)
    path = prefix ? "?prefix=#{prefix}" : ''
    bucket_request(:get, path)
  end

  def self.bucket_public_url(key)
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated
    # URL, and an <img> pointed at one breaks for every private object. This
    # serves published objects only.
    "#{BUCKET_ENDPOINT.sub(%r{/p/([^/]+)/bucket/?\\z}, '/pub/\\1')}/#{key}"
  end
end
\`\`\`

## Usage (Plain Ruby)

\`\`\`ruby
require_relative 'lib/moogo'

Moogo.sql(<<~SQL)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free'
  )
SQL

Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
          SecureRandom.uuid, "ketut@example.com", "pro")

users = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]))
puts users.inspect

# Bucket
content = File.read("avatar.png")
Moogo.bucket_upload("avatars/kit.png", content, "image/png")
puts Moogo.bucket_public_url("public/logo.png")
\`\`\`

---

## Rails Integration

### Service (\`app/services/moogo.rb\`)

\`\`\`ruby
# app/services/moogo.rb
class Moogo
  PROJECT_URL = Rails.application.credentials.moogo_project_url || ENV['MOOGO_PROJECT_URL']
  SECRET_KEY  = Rails.application.credentials.moogo_secret_key || ENV['MOOGO_SECRET_KEY']
  BUCKET_ENDPOINT = Rails.application.credentials.moogo_bucket_endpoint || ENV['MOOGO_BUCKET_ENDPOINT']
  BUCKET_ACCESS_KEY_ID = Rails.application.credentials.moogo_bucket_access_key_id || ENV['MOOGO_BUCKET_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = Rails.application.credentials.moogo_bucket_secret_key || ENV['MOOGO_BUCKET_SECRET_KEY']

  SQL_HEADERS = { 'Authorization' => "Bearer #{SECRET_KEY}", 'Content-Type' => 'application/json' }
  STORAGE_HEADERS = { 'X-Moogo-Access-Key-Id' => BUCKET_ACCESS_KEY_ID, 'Authorization' => "Bearer #{BUCKET_SECRET_KEY}" }

  class Error < StandardError
    attr_reader :code, :detail, :status
    def initialize(error, status = nil)
      @code = error['code']
      @detail = error['detail']
      @status = status
      super(error['message'])
    end
  end

  def self.client
    @@client ||= Faraday.new(PROJECT_URL) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end

  def self.storage_client
    @@storage_client ||= Faraday.new(BUCKET_ENDPOINT) do |f|
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end

  def self.read?(sql)
    # \`with\` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b/i)
  end

  # ── SQL ────────────────────────────────────────────────────────────
  def self.query(sql, args = [])
    res = client.post('/query') { |req| req.body = { query: sql, args: args }; req.headers.merge!(SQL_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.exec(sql, args = [])
    res = client.post('/exec') { |req| req.body = { query: sql, args: args }; req.headers.merge!(SQL_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.sql(sql, args = [])
    read?(sql) ? query(sql, args) : exec(sql, args)
  end

  def self.to_objects(result)
    cols = result['columns'] || []
    (result['rows'] || []).map { |row| cols.zip(row).to_h }
  end

  # ── Bucket ─────────────────────────────────────────────────────────
  def self.bucket_upload(key, content, content_type)
    res = storage_client.post("/#{key}") do |req|
      req.headers.merge!(STORAGE_HEADERS.merge('Content-Type' => content_type))
      req.body = content
    end
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.bucket_download(key)
    res = storage_client.get("/#{key}") { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new({ 'code' => 'download_failed' }, res.status) unless res.success?
    res.body
  end

  def self.bucket_delete(key)
    res = storage_client.delete("/#{key}") { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
  end

  def self.bucket_list(prefix = nil)
    path = prefix ? "?prefix=#{prefix}" : ''
    res = storage_client.get(path) { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.bucket_public_url(key)
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated
    # URL, and an <img> pointed at one breaks for every private object. This
    # serves published objects only.
    "#{BUCKET_ENDPOINT.sub(%r{/p/([^/]+)/bucket/?\\z}, '/pub/\\1')}/#{key}"
  end
end
\`\`\`

### Controller (\`app/controllers/users_controller.rb\`)

\`\`\`ruby
class UsersController < ApplicationController
  def index
    users = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users"))
    render json: users
  end

  def create
    user_id = SecureRandom.uuid
    Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
              user_id, params[:email], params[:plan] || 'free')
    render json: { id: user_id, email: params[:email] }, status: :created
  rescue Moogo::Error => e
    render json: { error: e.message }, status: :bad_request
  end

  def show
    user = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users WHERE id = ?", [params[:id]])).first
    render json: user || { error: 'Not found' }, status: user ? :ok : :not_found
  end
end
\`\`\`

### Storage Controller (\`app/controllers/storage_controller.rb\`)

\`\`\`ruby
class StorageController < ApplicationController
  def upload
    file = params[:file]
    Moogo.bucket_upload("uploads/#{file.original_filename}", file.read, file.content_type)
    render json: { url: Moogo.bucket_public_url("uploads/#{file.original_filename}") }
  end

  def list
    render json: Moogo.bucket_list('uploads/')['objects'] || []
  end

  def download
    content = Moogo.bucket_download(params[:key])
    send_data content, filename: params[:key].split('/').last, disposition: 'attachment'
  rescue Moogo::Error => e
    render json: { error: e.message }, status: e.status || 500
  end
end
\`\`\`

### Routes (\`config/routes.rb\`)

\`\`\`ruby
Rails.application.routes.draw do
  resources :users, only: [:index, :create, :show]
  post 'storage/upload', to: 'storage#upload'
  get 'storage/files', to: 'storage#list'
  get 'storage/download/*key', to: 'storage#download'
end
\`\`\`

### View Helper (\`app/helpers/moogo_helper.rb\`)

\`\`\`ruby
module MoogoHelper
  def moogo_public_url(key)
    Moogo.bucket_public_url(key)
  end
end
\`\`\`

\`\`\`erb
<%# usage %>
<%= image_tag moogo_public_url('public/avatars/user.png') %>
\`\`\`

### ActiveJob (background)

\`\`\`ruby
# app/jobs/process_users_job.rb
class ProcessUsersJob < ApplicationJob
  queue_as :moogo

  def perform(emails)
    emails.each do |email|
      Moogo.sql("INSERT INTO users (id, email) VALUES (?, ?)", [SecureRandom.uuid, email])
    end
  end
end
\`\`\`

\`\`\`ruby
ProcessUsersJob.perform_later(emails)
\`\`\`

## Sinatra / Hanami

\`\`\`ruby
# Sinatra example
require 'sinatra'
require_relative 'lib/moogo'

get '/users' do
  content_type :json
  Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users")).to_json
end

post '/users' do
  data = JSON.parse(request.body.read)
  id = SecureRandom.uuid
  Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, data['email'], data['plan'] || 'free'])
  { id: id, email: data['email'] }.to_json
end
\`\`\`

## Next

- [Python guide](/docs/guides/python-vanilla)
- [Go guide](/docs/guides/go)
- [Java/Kotlin guide](/docs/guides/java-kotlin)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};