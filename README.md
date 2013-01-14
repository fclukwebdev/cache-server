cache-server
============

A simple NodeJS cache server to sit in between local dev and remote environments.

## Setup Instructions

1. Clone repo to your server
2. Edit example-config.json as required and save as config.json
3. Run using `sudo node app.js` or setup an upstart conf file to run as a service in ubuntu, see cache-server.conf

Once the cache server is running you can use it by proxying requests to your local dev sites into the cache server.

For example in Apache you can use:

<pre>
ProxyPass           /    http://127.0.0.1:8888/
ProxyPassReverse    /    http://127.0.0.1:8888/
</pre>

You might like to only do this with certain folders though, or at least not do it with JS and CSS folders so you can work locally on these files.

## Config file

You can use the placeholder `{server_name}` with your config file to automatically insert the host name for use with multiple websites like so:

<pre>
{
    "cache_base": "/data/httpd/{server_name}/cache",
    "remote_server": "http://int.{server_name}",
    "server_port": 8888
}
</pre>

The config file contains three settings:

* `cache_base` - the folder you wish to cache files to.
* `remote_server` - the URL of the remote server to load pages from
* `server_port` - the port the