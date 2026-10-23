# Ruby / Rails

Works with Rails 7+, Sinatra, Hanami, or plain Ruby.

## Setup

```bash
# Gemfile
gem 'httparty'  # or use Net::HTTP (stdlib)
```

**Environment variables** (`.env` or Rails credentials):

```bash
export MOOGO_BASE_URL="https://api.moogo.dev"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SQL_KEY="moogo_..."
# Optional: origin public objects are served from; empty falls back to the API origin.
export MOOGO_CDN_URL="https://cdn.moogo.dev"
export MOOGO_STORAGE_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_STORAGE_SECRET_KEY="moogo_sk_..."
```

## Client (`lib/moogo.rb`)

```ruby
# lib/moogo.rb
require 'net/http'
require 'json'
require 'uri'
require 'erb'

class Moogo
  BASE_URL = ENV['MOOGO_BASE_URL'].to_s.sub(%r{/+\z}, '')
  PROJECT_ID = ENV['MOOGO_PROJECT_ID']
  SECRET_KEY  = ENV['MOOGO_SQL_KEY']
  PROJECT_ENDPOINT = "#{BASE_URL}/p/#{PROJECT_ID}"
  BUCKET_ENDPOINT = "#{PROJECT_ENDPOINT}/bucket"
  CDN_URL = ENV['MOOGO_CDN_URL'].to_s.sub(%r{/+\z}, '')
  BUCKET_ACCESS_KEY_ID = ENV['MOOGO_STORAGE_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = ENV['MOOGO_STORAGE_SECRET_KEY']

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
    uri = URI("#{PROJECT_ENDPOINT}#{path}")
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
    # `with` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i)
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
          when :patch then Net::HTTP::Patch.new(uri)
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
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    bucket_request(:post, "/#{path}", body: content, extra_headers: { 'Content-Type' => content_type })
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

  def self.bucket_publish(key)
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    body = JSON.generate({ is_public: true })
    bucket_request(:patch, "/#{path}", body: body, extra_headers: { 'Content-Type' => 'application/json' })
  end

  def self.bucket_public_url(key)
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated
    # URL, and an <img> pointed at one breaks for every private object. This
    # serves published objects only: a fresh upload is private, so publish it
    # with bucket_publish first. Until then, public_url in the response is an
    # empty string. When MOOGO_CDN_URL is set, public objects are served from
    # that CDN host instead of the API origin.
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    base = "#{BASE_URL}/pub/#{PROJECT_ID}"
    # Keep the /pub/<project-id> path, swap only the scheme and host.
    base = base.sub(%r{\Ahttps?://[^/]+}, CDN_URL) unless CDN_URL.empty?
    "#{base}/#{path}"
  end
end
```

## Usage (Plain Ruby)

```ruby
require 'securerandom'
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
key = "avatars/kit.png"
Moogo.bucket_upload(key, content, "image/png")
Moogo.bucket_publish(key)
puts Moogo.bucket_public_url(key)
```

---

## Rails Integration

### Service (`app/services/moogo.rb`)

```ruby
# app/services/moogo.rb
class Moogo
  BASE_URL = (Rails.application.credentials.moogo_base_url || ENV['MOOGO_BASE_URL']).to_s.sub(%r{/+\z}, '')
  PROJECT_ID = Rails.application.credentials.moogo_project_id || ENV['MOOGO_PROJECT_ID']
  SECRET_KEY  = Rails.application.credentials.moogo_secret_key || ENV['MOOGO_SQL_KEY']
  PROJECT_ENDPOINT = "#{BASE_URL}/p/#{PROJECT_ID}"
  BUCKET_ENDPOINT = "#{PROJECT_ENDPOINT}/bucket"
  CDN_URL = (Rails.application.credentials.moogo_cdn_url || ENV['MOOGO_CDN_URL']).to_s.sub(%r{/+\z}, '')
  BUCKET_ACCESS_KEY_ID = Rails.application.credentials.moogo_bucket_access_key_id || ENV['MOOGO_STORAGE_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = Rails.application.credentials.moogo_bucket_secret_key || ENV['MOOGO_STORAGE_SECRET_KEY']

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
    @@client ||= Faraday.new(PROJECT_ENDPOINT) do |f|
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
    # `with` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i)
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
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    res = storage_client.post("/#{path}") do |req|
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

  def self.bucket_publish(key)
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    res = storage_client.patch("/#{path}") do |req|
      req.headers.merge!(STORAGE_HEADERS.merge('Content-Type' => 'application/json'))
      req.body = JSON.generate({ is_public: true })
    end
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.bucket_public_url(key)
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated
    # URL, and an <img> pointed at one breaks for every private object. This
    # serves published objects only: a fresh upload is private, so publish it
    # with bucket_publish first. Until then, public_url in the response is an
    # empty string. When MOOGO_CDN_URL is set, public objects are served from
    # that CDN host instead of the API origin.
    path = key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')
    base = "#{BASE_URL}/pub/#{PROJECT_ID}"
    # Keep the /pub/<project-id> path, swap only the scheme and host.
    base = base.sub(%r{\Ahttps?://[^/]+}, CDN_URL) unless CDN_URL.empty?
    "#{base}/#{path}"
  end
end
```

### Controller (`app/controllers/users_controller.rb`)

```ruby
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
```

### Storage Controller (`app/controllers/storage_controller.rb`)

```ruby
class StorageController < ApplicationController
  def upload
    file = params[:file]
    key = "uploads/#{file.original_filename}"
    Moogo.bucket_upload(key, file.read, file.content_type)
    Moogo.bucket_publish(key)
    render json: { url: Moogo.bucket_public_url(key) }
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
```

### Routes (`config/routes.rb`)

```ruby
Rails.application.routes.draw do
  resources :users, only: [:index, :create, :show]
  post 'storage/upload', to: 'storage#upload'
  get 'storage/files', to: 'storage#list'
  get 'storage/download/*key', to: 'storage#download'
end
```

### View Helper (`app/helpers/moogo_helper.rb`)

```ruby
module MoogoHelper
  def moogo_public_url(key)
    Moogo.bucket_public_url(key)
  end
end
```

```erb
<%# usage %>
<%= image_tag moogo_public_url('public/avatars/user.png') %>
```

### ActiveJob (background)

```ruby
# app/jobs/process_users_job.rb
class ProcessUsersJob < ApplicationJob
  queue_as :moogo

  def perform(emails)
    emails.each do |email|
      Moogo.sql("INSERT INTO users (id, email) VALUES (?, ?)", [SecureRandom.uuid, email])
    end
  end
end
```

```ruby
ProcessUsersJob.perform_later(emails)
```

## Sinatra / Hanami

```ruby
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
```

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per `/transaction` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 256 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) are blocked as column names in SQL queries.
- **Public object URLs**: `public_url` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform `PATCH is_public: true` after upload if you want to share without credentials.
- **Error handling**: Use `error.code` rather than `error.message` for safe branching (retryable vs non-retryable).

## Next

- [Python guide](/docs/guides/python-vanilla)
- [Go guide](/docs/guides/go)
- [Java/Kotlin guide](/docs/guides/java-kotlin)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)