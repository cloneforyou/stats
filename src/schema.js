// Created with Apollo Launchpad
// https://launchpad.graphql.com/37p7j0nxlv

import { makeExecutableSchema } from 'graphql-tools'
import { subDays } from 'date-fns'
import fetch from 'node-fetch'
import xml2js from 'xml2js'

// get Date object for the day that was 30 days ago
const date = subDays(new Date(), 30)

// Construct a schema, using GraphQL schema language
const typeDefs = `
  type Album {
    name: String,
    artist: String
  }

  type Book {
    name: String,
    author: String
  }

  type Query {
    commits: Int @cacheControl(maxAge:3600),
    steps: Int @cacheControl(maxAge:3600),
    songs: Int @cacheControl(maxAge:3600),
    album: Album @cacheControl(maxAge:3600),
    book: Book @cacheControl(maxAge:86400)
  }
`

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    // GitHub Commits
    commits: (root, args, context) => {
      const query = `
        query recentCommits($date: GitTimestamp) {
          viewer {
            repositories(first: 100) {
              nodes {
                ref(qualifiedName: "master") {
                  target {
                    ... on Commit {
                      history(since:$date, first: 100) {
                        edges {
                          node {
                            author {
                              name
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            repositoriesContributedTo(first: 100) {
              nodes {
                ref(qualifiedName: "master") {
                  target {
                    ... on Commit {
                      history(since:$date, first: 100) {
                        edges {
                          node {
                            author {
                              name
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
      const variables = { date: date.toISOString() }
      return fetch(`https://api.github.com/graphql`, {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables,
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.secrets.GITHUB_KEY}`,
        },
      })
        .then(res => res.json())
        .then(json => {
          let amount = null
          if (json.data.viewer) {
            amount = 0
            json.data.viewer.repositories.nodes.forEach(node => {
              if (node.ref) {
                node.ref.target.history.edges.forEach(edge => {
                  if (edge.node.author.name === context.secrets.GITHUB_NAME) {
                    amount++
                  }
                })
              }
            })
            json.data.viewer.repositoriesContributedTo.nodes.forEach(node => {
              if (node.ref) {
                node.ref.target.history.edges.forEach(edge => {
                  if (edge.node.author.name === context.secrets.GITHUB_NAME) {
                    amount++
                  }
                })
              }
            })
          }
          return amount
        })
        .catch(err => {
          console.error(err)
          return { amount: null }
        })
    },

    // FitBit steps
    steps: (root, args, context) => {
      return fetch(
        'https://api.fitbit.com/1/user/-/activities/steps/date/today/30d.json',
        {
          headers: {
            Authorization: `Bearer ${context.secrets.FITBIT_KEY}`,
          },
        }
      )
        .then(res => res.json())
        .then(json => {
          let amount = null
          if (json['activities-steps']) {
            amount = 0
            json['activities-steps'].forEach(activity => {
              amount += parseInt(activity.value, 10)
            })
          }
          return amount
        })
        .catch(err => {
          console.error(err)
          return null
        })
    },

    // Last.fm top album & total songs
    songs: (root, args, context) => {
      return fetch(
        `http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&limit=1&user=lowmess&period=1month&api_key=${
          context.secrets.LASTFM_KEY
        }&format=json`
      )
        .then(res => res.json())
        .then(json => {
          let amount
          if (json.toptracks) {
            amount = json.toptracks['@attr'].total
          } else {
            amount = null
          }
          return amount
        })
        .catch(err => {
          console.error(err)
          return null
        })
    },
    album: (root, args, context) => {
      return fetch(
        `http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&limit=1&user=lowmess&period=1month&api_key=${
          context.secrets.LASTFM_KEY
        }&format=json`
      )
        .then(res => res.json())
        .then(json => {
          if (json.topalbums) {
            return {
              name: json.topalbums.album[0].name,
              artist: json.topalbums.album[0].artist.name,
            }
          } else {
            return { name: null, artist: null }
          }
        })
        .catch(err => {
          console.error(err)
          return { name: null, artist: null }
        })
    },

    // Goodreads book
    book: (root, args, context) => {
      return fetch(
        `https://www.goodreads.com/review/list?v=2&id=${
          context.secrets.GOODREADS_ID
        }&shelf=currently-reading&key=${context.secrets.GOODREADS_KEY}`
      )
        .then(res => res.text())
        .then(text => {
          let name, author
          xml2js.parseString(text, { normalizeTags: true }, (err, result) => {
            if (result.goodreadsresponse) {
              name =
                result.goodreadsresponse.reviews[0].review[0].book[0].title[0]
              author =
                result.goodreadsresponse.reviews[0].review[0].book[0].authors[0]
                  .author[0].name[0]
            } else {
              name = null
              author = null
            }
          })
          return { name, author }
        })
        .catch(err => {
          console.error(err)
          return { name: null, author: null }
        })
    },
  },
}

// Required: Export the GraphQL.js schema object as "schema"
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

// Optional: Export a function to get context from the request. It accepts two
// parameters - headers (lowercased http headers) and secrets (secrets defined
// in secrets section). It must return an object (or a promise resolving to it).
export function context(headers, secrets) {
  return {
    headers,
    secrets,
  }
}

// Optional: Export a root value to be passed during execution
// export const rootValue = {};

// Optional: Export a root function, that returns root to be passed
// during execution, accepting headers and secrets. It can return a
// promise. rootFunction takes precedence over rootValue.
// export function rootFunction(headers, secrets) {
//   return {
//     headers,
//     secrets,
//   };
// };