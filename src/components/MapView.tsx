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
 *   Blue dotted:  Ride (straight line, pickup → drop-off; not the driving route)
 *   Green solid:  Walking route from the drop-off to the destination
 */

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import type { SearchResult, Option } from '@/lib/types'
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
  selectedOption?: Option
}

export default function MapView({ results, selectedOption }: MapViewProps) {
  const { pickup, destination, options } = results
  const highlighted = selectedOption ?? results.best

  // Calculate map bounds to fit all markers
  const allLats = [
    pickup.lat,
    destination.lat,
    ...options.map((o) => o.lat),
  ]
  const allLngs = [
    pickup.lng,
    destination.lng,
    ...options.map((o) => o.lng),
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
        {options.map((option, i) => {
          const isBest = i === 0 && results.verdict === 'walk'
          const isHighlighted = highlighted?.id === option.id
          const color = isBest ? '#10b981' : '#eab308'
          const size = isHighlighted ? 18 : 12

          return (
            <Marker
              key={option.id}
              position={[option.lat, option.lng]}
              icon={createColoredIcon(color, size)}
            >
              <Popup>
                <div className="min-w-[160px]">
                  {isBest && <p className="text-emerald-600 font-bold text-xs mb-1">⭐ Best option</p>}
                  <p className="font-semibold text-sm">{option.label}</p>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>🚗 Ride: <strong>€{option.fare.toFixed(2)}</strong></p>
                    <p>🚶 Walk: <strong>{Math.round(option.walkMinutes)} min</strong></p>
                    <p>💰 Real gain: <strong className={option.net >= 1 ? 'text-emerald-600' : 'text-red-600'}>€{option.net.toFixed(2)}</strong></p>
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
              [highlighted.lat, highlighted.lng],
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
        {highlighted && highlighted.walkPolyline.length > 0 && (
          <Polyline
            positions={highlighted.walkPolyline.map(
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
          <LegendItem color="#10b981" label="Best option" />
          <LegendItem color="#eab308" label="Alternative" />
          <div className="flex items-center gap-2 mt-2">
            <div className="w-6 border-t-2 border-blue-400 border-dashed" aria-hidden="true" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Ride (straight line)</span>
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
