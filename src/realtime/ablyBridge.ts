import * as Ably from 'ably';
import { RealtimeMessage } from './types.js';

export interface AblyBridgeOptions {
  apiKey: string;
  originServerId: string;
}

/**
 * AblyFederationBridge: Bridges local WebSocket rooms to Ably Cloud pub/sub channels.
 * 
 * Allows users connected locally or via Tailscale to collaborate live with remote cloud
 * users on Ably channel `whiteboard:<boardName>` with zero inbound port-forwarding needed.
 * Includes originServerId tagging to prevent echo loops.
 */
export class AblyFederationBridge {
  private client: Ably.Realtime;
  private restClient: Ably.Rest;
  private originServerId: string;
  private channels = new Map<string, Ably.RealtimeChannel>();
  private messageHandlers = new Map<string, (msg: RealtimeMessage) => void>();
  private isConnected = false;

  constructor(options: AblyBridgeOptions) {
    this.originServerId = options.originServerId;
    this.client = new Ably.Realtime({
      key: options.apiKey,
      clientId: `server-${options.originServerId}`,
      autoConnect: true,
    });
    this.restClient = new Ably.Rest({
      key: options.apiKey,
    });

    this.client.connection.on('connected', () => {
      this.isConnected = true;
      console.log(`[AblyBridge] Connected to Ably Realtime Cloud (originId: ${this.originServerId})`);
    });

    this.client.connection.on('failed', (stateChange) => {
      this.isConnected = false;
      console.error('[AblyBridge] Ably connection failed:', stateChange.reason);
    });

    this.client.connection.on('disconnected', () => {
      this.isConnected = false;
    });
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public getOriginServerId(): string {
    return this.originServerId;
  }

  /**
   * Generates a signed Ably TokenRequest for client authentication.
   */
  public async createTokenRequest(
    boardName: string,
    actorId: string,
    capabilities: string[] = ['publish', 'subscribe', 'presence']
  ): Promise<Ably.TokenRequest> {
    const channelName = `whiteboard:${boardName}`;
    const tokenParams: Ably.TokenParams = {
      clientId: actorId,
      capability: JSON.stringify({
        [channelName]: capabilities,
      }),
      ttl: 3600 * 1000 * 24, // 24 hours
    };

    return await this.restClient.auth.createTokenRequest(tokenParams);
  }

  /**
   * Attaches to an Ably channel for a board and registers an inbound message listener.
   */
  public attachBoard(boardName: string, onRemoteMessage: (msg: RealtimeMessage) => void): void {
    if (this.channels.has(boardName)) return;

    const channelName = `whiteboard:${boardName}`;
    const channel = this.client.channels.get(channelName);
    this.channels.set(boardName, channel);
    this.messageHandlers.set(boardName, onRemoteMessage);

    channel.subscribe((message) => {
      try {
        const payload = (typeof message.data === 'string'
          ? JSON.parse(message.data)
          : message.data) as RealtimeMessage;

        // Discard messages originating from this server to eliminate echo loops
        if (payload && payload.originServerId === this.originServerId) {
          return;
        }

        onRemoteMessage(payload);
      } catch (err) {
        console.error(`[AblyBridge] Error parsing incoming message on ${channelName}:`, err);
      }
    });

    console.log(`[AblyBridge] Subscribed to Ably channel ${channelName}`);
  }

  /**
   * Publishes a message to the Ably channel, stamped with this server's origin ID.
   */
  public publish(boardName: string, message: RealtimeMessage): void {
    const channel = this.channels.get(boardName);
    if (!channel) return;

    const stampedMessage: RealtimeMessage = {
      ...message,
      originServerId: this.originServerId,
    };

    channel.publish(message.type, stampedMessage).catch((err) => {
      console.warn(`[AblyBridge] Failed to publish ${message.type} to board ${boardName}:`, err);
    });
  }

  /**
   * Cleanly closes all Ably channel subscriptions and the connection.
   */
  public close(): void {
    for (const [boardName, channel] of this.channels.entries()) {
      channel.unsubscribe();
      channel.detach().catch(() => {});
    }
    this.channels.clear();
    this.messageHandlers.clear();
    this.client.close();
  }
}
