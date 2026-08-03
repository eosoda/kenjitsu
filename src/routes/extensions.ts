import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { animeExtensionRegistry } from '../registry/anime.js';
import type { FastifyParams, FastifyQuery } from '../utils/types.js';

type ExtensionParams = FastifyParams & { extensionId?: string; animeId?: string };
type AnimeParserWithEpisodes = {
  fetchEpisodes?: (animeId: string) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const responseStatus = (value: unknown): number => {
  if (!isRecord(value) || typeof value.status !== 'number') return 200;
  return value.status >= 400 && value.status <= 599 ? value.status : 200;
};

const sendExtensionResult = (reply: FastifyReply, extensionId: string, result: unknown) => {
  if (!isRecord(result)) {
    return reply.status(502).send({ provider: extensionId, data: null, error: 'Extension returned an invalid response' });
  }

  return reply.status(responseStatus(result)).send({ provider: extensionId, ...result });
};

const getDefinition = (reply: FastifyReply, extensionId?: string) => {
  if (!extensionId) {
    reply.status(400).send({ error: "Missing required path parameter: 'extensionId'" });
    return null;
  }

  const definition = animeExtensionRegistry.get(extensionId);
  if (!definition) {
    reply.status(404).send({ error: `Unknown anime extension: '${extensionId}'` });
    return null;
  }

  return definition;
};

export default async function AnimeExtensionRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => reply.status(200).send({ data: animeExtensionRegistry.list() }));

  fastify.get(
    '/:extensionId/search',
    async (request: FastifyRequest<{ Params: ExtensionParams; Querystring: FastifyQuery }>, reply: FastifyReply) => {
      const definition = getDefinition(reply, request.params.extensionId);
      const query = request.query.q?.trim();
      if (!definition) return;
      if (!query) return reply.status(400).send({ error: "Missing required query param: 'q'" });
      if (query.length > 1000) return reply.status(400).send({ error: 'Query string too long' });

      try {
        const result = await definition.create().search(query, request.query.page);
        return sendExtensionResult(reply, request.params.extensionId!, result);
      } catch (error) {
        request.log.error({ error, provider: request.params.extensionId }, 'Anime extension search failed');
        return reply.status(502).send({ provider: request.params.extensionId, data: [], error: 'Extension search failed' });
      }
    },
  );

  fastify.get(
    '/:extensionId/anime/:animeId',
    async (request: FastifyRequest<{ Params: ExtensionParams }>, reply: FastifyReply) => {
      const definition = getDefinition(reply, request.params.extensionId);
      if (!definition) return;
      if (!request.params.animeId) return reply.status(400).send({ error: "Missing required path parameter: 'animeId'" });

      try {
        const parser = definition.create();
        const result = await parser.fetchAnimeInfo(request.params.animeId);
        if (isRecord(result) && !Array.isArray(result.providerEpisodes)) {
          const fetchEpisodes = (parser as AnimeParserWithEpisodes).fetchEpisodes;
          if (fetchEpisodes) {
            try {
              const episodesResult = await fetchEpisodes.call(parser, request.params.animeId);
              const providerEpisodes = isRecord(episodesResult) && Array.isArray(episodesResult.data) ? episodesResult.data : [];
              return sendExtensionResult(reply, request.params.extensionId!, { ...result, providerEpisodes });
            } catch (episodesError) {
              request.log.warn({ error: episodesError, provider: request.params.extensionId }, 'Anime extension episode lookup failed');
            }
          }
        }
        return sendExtensionResult(reply, request.params.extensionId!, result);
      } catch (error) {
        request.log.error({ error, provider: request.params.extensionId }, 'Anime extension info failed');
        return reply.status(502).send({ provider: request.params.extensionId, data: null, error: 'Extension info failed' });
      }
    },
  );

  fastify.get(
    '/:extensionId/sources',
    async (request: FastifyRequest<{ Params: ExtensionParams; Querystring: FastifyQuery }>, reply: FastifyReply) => {
      const definition = getDefinition(reply, request.params.extensionId);
      const episodeId = request.query.episodeId;
      if (!definition) return;
      if (!episodeId) return reply.status(400).send({ error: "Missing required query param: 'episodeId'" });

      const optionalArguments = [request.query.version, request.query.server].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      );

      try {
        const result = await definition.create().fetchSources(episodeId, ...optionalArguments);
        return sendExtensionResult(reply, request.params.extensionId!, result);
      } catch (error) {
        request.log.error({ error, provider: request.params.extensionId }, 'Anime extension source resolution failed');
        return reply
          .status(502)
          .send({ provider: request.params.extensionId, data: null, error: 'Extension source resolution failed' });
      }
    },
  );
}
