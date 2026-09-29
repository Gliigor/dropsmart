'use client'

/**
 * MapView component.
 * Uses react-leaflet with OpenStreetMap tiles.
 * Must be loaded with dynamic import (no SSR) because Leaflet uses window.
 *
 * Markers:
 *   🔵 Blue:   Pickup
 *   🔴 Red:    Final destination
 *   🟢 Green:  Recommended drop-off
 *   🟡 Yellow: Other alternatives
 *
 * Lines:
 *   Blue dotted:  Ride route (straight line, pickup → drop-off)
 *   Green solid:  Walking route polyline from ORS
 */

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import type { SearchResult, Alternative } from '@/providers/types'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon issue in Next.js
import L from 'leaflet'

function createColoredIcon(color: string, size: number = 12) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface MapViewProps {
  results: SearchResult
  selectedAlternative?: Alternative
}

export default function MapView({ results, selectedAlternative }: MapViewProps) {
  const { pickup, destination, alternatives, bestAlternative } = results
  const highlighted = selectedAlternative ?? bestAlternative

  // Calculate map bounds to fit all markers
  const allLats = [
    pickup.lat,
    destination.lat,
    ...alternatives.map((a) => a.candidate.lat),
  ]
  const allLngs = [
    pickup.lng,
    destination.lng,
    ...alternatives.map((a) => a.candidate.lng),
  ]

  const minLat = Math.min(...allLats)
  const maxLat = Math.max(...allLats)
  const minLng = Math.min(...allLngs)
  const maxLng = Math.max(...allLngs)

  const center: LatLngExpression = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2,
  ]

  const bounds: [[number, number], [number, number]] = [
    [minLat - 0.002, minLng - 0.002],
    [maxLat + 0.002, maxLng + 0.002],
  ]

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-lg" role="region" aria-label="Map showing drop-off alternatives">
      <MapContainer
        center={center}
        zoom={14}
        bounds={bounds}
        className="h-full w-full"
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pickup marker (blue) */}
        <Marker
          position={[pickup.lat, pickup.lng]}
          icon={createColoredIcon('#3b82f6', 16)}
        >
          <Popup>
            <strong>📍 Pickup</strong>
            <br />
            <span className="text-sm text-gray-600">{pickup.label.split(',').slice(0, 2).join(',')}</span>
          </Popup>
        </Marker>

        {/* Final destination marker (red) */}
        <Marker
          position={[destination.lat, destination.lng]}
          icon={createColoredIcon('#ef4444', 16)}
        >
          <Popup>
            <strong>🏁 Destination</strong>
            <br />
            <span className="text-sm text-gray-600">{destination.label.split(',').slice(0, 2).join(',')}</span>
          </Popup>
        </Marker>

        {/* Alternative drop-off markers */}
        {alternatives.map((alt, i) => {
          const isRecommended = i === 0
          const isHighlighted = highlighted?.candidate.lat === alt.candidate.lat &&
                                highlighted?.candidate.lng === alt.candidate.lng

          const color = isRecommended ? '#10b981' : '#eab308'
          const size = isHighlighted ? 18 : 12

          return (
            <Marker
              key={`${alt.candidate.lat}-${alt.candidate.lng}`}
              position={[alt.candidate.lat, alt.candidate.lng]}
              icon={createColoredIcon(color, size)}
            >
              <Popup>
                <div className="min-w-[160px]">
                  {isRecommended && <p className="text-emerald-600 font-bold text-xs mb-1">⭐ Best deal</p>}
                  <p className="font-semibold text-sm">{alt.candidate.label}</p>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>🚗 Fare: <strong>€{alt.bestFare.price.toFixed(2)}</strong> <span className="text-amber-500">(est.)</span></p>
                    <p>🚶 Walk: <strong>{alt.walkingRoute.durationMinutes} min</strong></p>
                    <p>💰 Saves: <strong className="text-emerald-600">€{alt.savings.toFixed(2)}</strong></p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Ride route: dotted blue line from pickup to recommended drop-off */}
        {highlighted && (
          <Polyline
            positions={[
              [pickup.lat, pickup.lng],
              [highlighted.candidate.lat, highlighted.candidate.lng],
            ]}
            pathOptions={{
              color: '#3b82f6',
              weight: 3,
              dashArray: '8 6',
              opacity: 0.8,
            }}
          />
        )}

        {/* Walking route: solid green line from drop-off to destination */}
        {highlighted && highlighted.walkingRoute.polyline.length > 0 && (
          <Polyline
            positions={highlighted.walkingRoute.polyline.map(
              ([lng, lat]) => [lat, lng] as LatLngExpression
            )}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.9,
            }}
          />
        )}

        {/* Map legend */}
        <MapLegend />
      </MapContainer>
    </div>
  )
}

function MapLegend() {
  useEffect(() => {
    // Legend is rendered in DOM by Leaflet control
  }, [])

  return (
    <div className="leaflet-bottom leaflet-left">
      <div
        className="leaflet-control bg-white/95 dark:bg-gray-800/95 rounded-xl shadow-lg p-3 m-3"
        style={{ backdropFilter: 'blur(4px)' }}
        aria-label="Map legend"
      >
        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Legend</p>
        <div className="space-y-1.5">
          <LegendItem color="#3b82f6" label="Pickup" />
          <LegendItem color="#ef4444" label="Destination" />
          <LegendItem color="#10b981" label="Best drop-off" />
          <LegendItem color="#eab308" label="Alternative" />
          <div className="flex items-center gap-2 mt-2">
            <div className="w-6 border-t-2 border-blue-400 border-dashed" aria-hidden="true" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Ride route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-emerald-500" aria-hidden="true" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Walk route</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  )
}
